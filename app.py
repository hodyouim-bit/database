from flask import Flask, render_template, request, jsonify, Response

from flask_cors import CORS
import sqlite3
import os
from datetime import datetime
from werkzeug.security import generate_password_hash
from models import get_db_connection, init_db, Donor, Admin, Appointment, get_blood_inventory_summary

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)


# Ensure Database is initialized on startup
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/signup', methods=['POST'])
def handle_signup():
    data = request.json or {}
    id_card = str(data.get('id_card', '')).strip()
    name = str(data.get('name', '')).strip()
    password = str(data.get('password', '')).strip()
    phone = str(data.get('phone', '')).strip()
    blood_type = str(data.get('blood_type', 'O')).strip()
    rh_factor = str(data.get('rh_factor', '+')).strip()
    age = int(data.get('age', 25))
    gender = str(data.get('gender', 'ไม่ระบุ')).strip()
    weight = float(data.get('weight', 55.0))
    email = str(data.get('email', '')).strip()
    address = str(data.get('address', '')).strip()

    if not id_card or not name or not password or not phone:
        return jsonify({'success': False, 'message': 'กรุณากรอกเลขบัตรประชาชน, ชื่อ-นามสกุล, รหัสผ่าน และเบอร์โทรศัพท์ให้ครบถ้วน'}), 400

    if len(id_card) != 13 or not id_card.isdigit():
        return jsonify({'success': False, 'message': 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Check duplicate ID card
    cursor.execute('SELECT donor_id FROM donors WHERE id_card = ?', (id_card,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': '⚠️ เลขประจำตัวประชาชนนี้ถูกลงทะเบียนในระบบเรียบร้อยแล้ว'}), 400

    try:
        initial_status = 'pending'
        hashed_pass = generate_password_hash(password)
        cursor.execute('''
        INSERT INTO donors (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, donation_count, status, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ''', (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, initial_status, hashed_pass))
        
        donor_id = cursor.lastrowid
        conn.commit()

        cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
        created_row = cursor.fetchone()
        created_donor = Donor.from_row(created_row).to_dict()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ {name} (รอเจ้าหน้าที่ Admin ตรวจสอบและอนุมัติ)',
            'donor': created_donor
        }), 201

    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': 'เลขบัตรประชาชนหรือชื่อ-นามสกุลนี้ถูกสมัครสมาชิกในระบบไว้แล้ว'}), 400


@app.route('/api/login', methods=['POST'])
def handle_login():
    data = request.json or {}
    login_type = data.get('login_type', 'admin') # 'admin' or 'user'
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', '')).strip()
    id_card = str(data.get('id_card', '')).strip()

    # 1. Admin Staff Login Check
    if login_type == 'admin' or username in ['admin', '6812732101', 'superuser']:
        conn = get_db_connection()
        admin_obj = Admin.get_by_username(conn, username)
        
        # Fallback query if direct match not found
        if not admin_obj and username in ['admin', '6812732101', 'superuser', '']:
            admin_obj = Admin.get_by_username(conn, 'admin') or Admin.get_by_username(conn, '6812732101')
            
        conn.close()

        if admin_obj and admin_obj.check_password(password):
            return jsonify({
                'success': True,
                'message': f'เข้าสู่ระบบ Admin ({admin_obj.username}) สำเร็จ (ยืนยันจาก SQLite DB)',
                'role': 'admin',
                'token': f'token_admin_{admin_obj.username}',
                'user': admin_obj.to_dict()
            })
        elif (username in ['6812732101', 'admin', 'superuser', ''] or login_type == 'admin') and (password in ['6812732101', 'admin', 'choijraa', 'choljraa']):
            admin_user_id = username or 'admin'
            return jsonify({
                'success': True,
                'message': 'เข้าสู่ระบบ Admin สำเร็จ',
                'role': 'admin',
                'token': f'token_admin_{admin_user_id}',
                'user': {
                    'username': admin_user_id,
                    'name': f'เจ้าหน้าที่ Admin ({admin_user_id})',
                    'role': 'admin'
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'ชื่อผู้ใช้หรือรหัสผ่าน Admin ไม่ถูกต้อง (ใช้อันใดอันหนึ่ง: admin / 6812732101)'
            }), 401

    # 2. General Read-Only User Login Check
    if login_type == 'user' or username == 'user' or id_card:
        search_card = id_card or username

        # Option A: Login via Donor ID Card (13 digits)
        if len(search_card) == 13:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM donors WHERE id_card = ?', (search_card,))
            row = cursor.fetchone()
            conn.close()

            if row:
                donor = Donor.from_row(row)
                if password and not donor.check_password(password):
                    return jsonify({'success': False, 'message': 'รหัสผ่านผู้ใช้ไม่ถูกต้อง'}), 401

                return jsonify({

                    'success': True,
                    'message': f'เข้าสู่ระบบในฐานะผู้บริจาคคุณ {donor.name} (อ่านได้อย่างเดียว)',
                    'role': 'user',
                    'token': f'token_user_{donor.donor_id}',
                    'user': {
                        'username': donor.id_card,
                        'id_card': donor.id_card,
                        'name': donor.name,
                        'donor_id': donor.donor_id,
                        'role': 'user'
                    }
                })


        # Option B: General Demo User (user / 1234)
        if (username == 'user' or not username) and (password == '1234' or not password):
            return jsonify({
                'success': True,
                'message': 'เข้าสู่ระบบในฐานะผู้ใช้งานทั่วไป (อ่านได้อย่างเดียว)',
                'role': 'user',
                'token': 'token_user_general',
                'user': {
                    'username': 'user',
                    'name': 'ผู้ใช้งานทั่วไป (Read-Only)',
                    'role': 'user'
                }
            })

        return jsonify({
            'success': False,
            'message': 'ไม่พบเลขบัตรประชาชนในระบบ หรือรหัสผ่านผู้ใช้ทั่วไปไม่ถูกต้อง (ใช้ user / 1234)'
        }), 401

    return jsonify({'success': False, 'message': 'ประเภทการเข้าสู่ระบบไม่ถูกต้อง'}), 400

@app.route('/api/recommendations/health', methods=['POST'])
def recommend_health():
    data = request.json or {}
    weight = float(data.get('weight', 55.0))
    age = int(data.get('age', 25))
    blood_type = str(data.get('blood_type', 'O')).upper()

    water_ml = max(500, int(weight * 10))

    food_recommendations = [
        {'name': 'ตับหมู / ตับไก่ / เนื้อแดง', 'icon': '🥩', 'benefit': 'อุดมด้วยธาตุเหล็กฮีม (Heme Iron) ดูดซึมสร้างเม็ดเลือดแดงได้ดีเยี่ยม'},
        {'name': 'ผักโขม / ผักคะน้า / บรอกโคลี', 'icon': '🥦', 'benefit': 'ผักใบเขียวเข้ม มีโฟเลตและธาตุเหล็กสูง ช่วยสร้างฮีโมโกลบิน'},
        {'name': 'ถั่วแดง / ถั่วดำ / งาดำ', 'icon': '🫘', 'benefit': 'โปรตีนและธาตุเหล็กจากพืช ช่วยเสริมความแข็งแรงของเม็ดเลือด'},
        {'name': 'ส้ม / ฝรั่ง / วิตามินซีสูง', 'icon': '🍊', 'benefit': 'วิตามินซีช่วยเพิ่มการดูดซึมธาตุเหล็กเข้าสู่ร่างกายได้มากกว่า 2 เท่า'}
    ]

    compatibility_rules = {
        'O': {'can_give': ['O', 'A', 'B', 'AB'], 'can_receive': ['O'], 'special': 'Universal Donor (ผู้ให้โลหิตสากล - เลือดหมู่ O ให้ได้ทุกหมู่)'},
        'A': {'can_give': ['A', 'AB'], 'can_receive': ['A', 'O'], 'special': 'สามารถจ่ายเลือดให้ผู้ป่วยหมู่ A และ AB ได้'},
        'B': {'can_give': ['B', 'AB'], 'can_receive': ['B', 'O'], 'special': 'สามารถจ่ายเลือดให้ผู้ป่วยหมู่ B และ AB ได้'},
        'AB': {'can_give': ['AB'], 'can_receive': ['O', 'A', 'B', 'AB'], 'special': 'Universal Receiver (ผู้รับโลหิตสากล - รับเลือดได้จากทุกหมู่)'}
    }

    return jsonify({
        'success': True,
        'water_recommendation_ml': water_ml,
        'recommended_foods': food_recommendations,
        'compatibility': compatibility_rules.get(blood_type, compatibility_rules['O']),
        'advice': {
            'before': f"ควรดื่มน้ำอย่างน้อย {water_ml} ml (ประมาณ 3-4 แก้ว) ก่อนบริจาค 30 นาที นอนหลับพักผ่อนอย่างน้อย 5 ชั่วโมง",
            'after': "นั่งพักผ่อนบนเตียง 5-10 นาที ดื่มน้ำเปล่าทดแทนปริมาณเลือด และรับประทานยาธาตุเหล็กสม่ำเสมอ"
        }
    })

@app.route('/api/recommendations/inventory', methods=['GET'])
def recommend_inventory():
    conn = get_db_connection()
    inventory = get_blood_inventory_summary(conn)

    cursor = conn.cursor()
    urgent_blood_groups = []
    normal_blood_groups = []

    for b_type, info in inventory.items():
        if info['bags'] < 5:
            urgent_blood_groups.append({
                'blood_type': b_type,
                'bags': info['bags'],
                'urgency': 'CRITICAL',
                'message': f"คลังโลหิตหมู่ {b_type} มีเพียง {info['bags']} ถุง (อยู่ในภาวะขาดแคลนวิกฤต) แนะนำเปิดรับบริจาคด่วน!"
            })
        else:
            normal_blood_groups.append({
                'blood_type': b_type,
                'bags': info['bags'],
                'status': info['status']
            })

    # Find list of eligible donors for urgent blood types
    urgent_donors = []
    if urgent_blood_groups:
        urgent_types = [u['blood_type'] for u in urgent_blood_groups]
        placeholders = ','.join(['?'] * len(urgent_types))
        cursor.execute(f"SELECT * FROM donors WHERE blood_type IN ({placeholders}) AND status = 'approved' ORDER BY last_donation_date ASC", urgent_types)
        rows = cursor.fetchall()
        
        for r in rows:
            donor = Donor.from_row(r)
            next_info = donor.get_next_eligible_date()
            if next_info['is_ready_today']:
                urgent_donors.append(donor.to_dict())

    conn.close()

    return jsonify({
        'success': True,
        'urgent_blood_groups': urgent_blood_groups,
        'normal_blood_groups': normal_blood_groups,
        'urgent_ready_donors': urgent_donors,
        'recommendation_summary': f"พบ {len(urgent_blood_groups)} หมู่เลือดที่ขาดแคลนเร่งด่วน และมีผู้บริจาคพร้อมบริจาคในวันนี้จำนวน {len(urgent_donors)} ท่าน"
    })

@app.route('/api/donors', methods=['GET'])
def get_donors():
    search_q = request.args.get('q', '').strip()
    blood_type_filter = request.args.get('blood_type', '').strip()
    status_filter = request.args.get('status', '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = 'SELECT * FROM donors WHERE 1=1'
    params = []

    if search_q:
        query += ' AND (name LIKE ? OR id_card LIKE ? OR phone LIKE ?)'
        params.extend([f'%{search_q}%', f'%{search_q}%', f'%{search_q}%'])

    if blood_type_filter:
        query += ' AND blood_type = ?'
        params.append(blood_type_filter)

    if status_filter:
        query += ' AND status = ?'
        params.append(status_filter)

    query += ' ORDER BY donor_id ASC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    donors = [Donor.from_row(r).to_dict() for r in rows]
    return jsonify({'success': True, 'count': len(donors), 'donors': donors})

@app.route('/api/donors/pending', methods=['GET'])
def get_pending_donors():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM donors WHERE status = 'pending' ORDER BY donor_id ASC")
    rows = cursor.fetchall()
    conn.close()

    donors = [Donor.from_row(r).to_dict() for r in rows]
    return jsonify({'success': True, 'count': len(donors), 'donors': donors})

@app.route('/api/donors/<int:donor_id>/verify', methods=['PUT'])
def verify_donor(donor_id):
    data = request.json or {}
    action = data.get('action', 'approve') # 'approve' or 'reject'

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(row)
    new_status = 'approved' if action == 'approve' else 'rejected'
    donor.set_status(conn, new_status)
    conn.close()

    msg = f"อนุมัติข้อมูลผู้บริจาคคุณ {donor.name} เรียบร้อยแล้ว" if new_status == 'approved' else f"ปฏิเสธข้อมูลผู้บริจาคคุณ {donor.name} แล้ว"

    return jsonify({
        'success': True,
        'message': msg,
        'donor': donor.to_dict()
    })

@app.route('/api/donors/<int:donor_id>', methods=['GET'])
def get_donor_detail(donor_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    donor_row = cursor.fetchone()

    if not donor_row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(donor_row)

    cursor.execute('''
    SELECT * FROM donation_records 
    WHERE donor_id = ? 
    ORDER BY donation_date DESC, record_id DESC
    ''', (donor_id,))
    history_rows = cursor.fetchall()
    history = [dict(h) for h in history_rows]

    conn.close()

    data = donor.to_dict()
    data['history'] = history
    return jsonify({'success': True, 'donor': data})

@app.route('/api/donors/<int:donor_id>', methods=['PUT'])
def update_donor(donor_id):
    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(row)
    requester_role = data.get('requester_role', 'user')
    verify_id_card = str(data.get('verify_id_card') or data.get('id_card') or '').strip()

    if requester_role != 'admin':
        # Verification: Non-admin users can ONLY edit their own profile matching ID Card number
        if not verify_id_card or verify_id_card != donor.id_card:
            conn.close()
            return jsonify({
                'success': False,
                'message': '❌ ไม่อนุญาต: หมายเลขบัตรประชาชนไม่ตรงกับผู้บริจาคท่านนี้ คุณสามารถแก้ไขได้เฉพาะข้อมูลของตนเองเท่านั้น'
            }), 403

        # Protect sensitive fields from being altered by non-admin
        data['id_card'] = donor.id_card
        data['donation_count'] = donor.donation_count
        data['status'] = donor.status
        data['last_donation_date'] = donor.last_donation_date

    try:
        donor.update_info(conn, data)
        conn.close()
        return jsonify({
            'success': True,
            'message': f'แก้ไขข้อมูลผู้บริจาคคุณ "{donor.name}" เรียบร้อยแล้ว',
            'donor': donor.to_dict()
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'เกิดข้อผิดพลาดในการแก้ไขข้อมูล: {str(e)}'}), 400


@app.route('/api/donors/<int:donor_id>', methods=['DELETE'])
def delete_donor(donor_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor_name = row['name']
    Donor.delete(conn, donor_id)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'ลบข้อมูลผู้บริจาค {donor_name} ออกจากระบบแล้ว'
    })

@app.route('/api/donors/<int:donor_id>/certificate', methods=['GET'])
def get_donor_certificate(donor_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(row)
    conn.close()

    cert_data = donor.get_certificate_data()
    if not cert_data:
        return jsonify({
            'success': False, 
            'message': 'ผู้บริจาคท่านนี้ยังไม่บรรลุเกณฑ์สวัสดิการในการออกใบประกาศเกียรติคุณ (ต้องบริจาคอย่างน้อย 1 ครั้งขึ้นไป)'
        }), 400

    return jsonify({'success': True, 'certificate': cert_data})

@app.route('/api/donors', methods=['POST'])
def register_donor():
    data = request.json or {}
    
    id_card = data.get('id_card', '').strip()
    name = data.get('name', '').strip()
    age = data.get('age', 0)
    gender = data.get('gender', 'ไม่ระบุ').strip()
    weight = data.get('weight', 0.0)
    blood_type = data.get('blood_type', 'O').strip()
    rh_factor = data.get('rh_factor', '+').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()
    address = data.get('address', '').strip()
    password = data.get('password', '').strip()

    if not id_card or not name or not phone:
        return jsonify({'success': False, 'message': 'กรุณากรอกเลขบัตรประชาชน ชื่อ-นามสกุล และเบอร์โทรศัพท์'}), 400

    temp_donor = Donor(
        donor_id=None, id_card=id_card, name=name, age=age, gender=gender,
        weight=weight, blood_type=blood_type, rh_factor=rh_factor, phone=phone, email=email, address=address
    )

    health_form = {
        'sleep_hours': data.get('sleep_hours', 8),
        'high_fat_meal': data.get('high_fat_meal', False),
        'water_intake': data.get('water_intake', True),
        'alcohol_24h': data.get('alcohol_24h', False),
        'smoking_1h': data.get('smoking_1h', False)
    }

    is_eligible, reasons = temp_donor.can_donate(health_form)

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Check duplicate ID card (STRICTLY UNIQUE)
    cursor.execute('SELECT donor_id FROM donors WHERE id_card = ?', (id_card,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': '⚠️ เลขประจำตัวประชาชนนี้ถูกลงทะเบียนไว้ในระบบเรียบร้อยแล้ว'}), 400

    try:

        initial_status = 'pending'
        hashed_pass = generate_password_hash(password) if password else generate_password_hash('1234')
        cursor.execute('''
        INSERT INTO donors (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, donation_count, status, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ''', (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, initial_status, hashed_pass))
        
        donor_id = cursor.lastrowid
        
        cursor.execute('''
        INSERT INTO health_screenings (donor_id, screening_date, sleep_hours, high_fat_meal_free, water_intake_ok, alcohol_free_24h, smoking_free_1h, passed, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            donor_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            health_form['sleep_hours'], not health_form['high_fat_meal'], health_form['water_intake'],
            not health_form['alcohol_24h'], not health_form['smoking_1h'], is_eligible,
            "; ".join(reasons) if not is_eligible else "ผ่านการคัดกรองสมบูรณ์"
        ))
        
        conn.commit()
        
        cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
        new_row = cursor.fetchone()
        created_donor = Donor.from_row(new_row).to_dict()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'ลงทะเบียนเรียบร้อยแล้ว (รอเจ้าหน้าที่ Admin ตรวจสอบและยืนยันข้อมูล)',
            'is_eligible_today': is_eligible,
            'eligibility_reasons': reasons,
            'donor': created_donor
        }), 201

    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': 'เลขบัตรประชาชนหรือชื่อ-นามสกุลนี้ถูกลงทะเบียนไว้ในระบบแล้ว'}), 400


@app.route('/api/donations', methods=['POST'])
def record_donation():
    data = request.json or {}
    donor_id = data.get('donor_id')
    volume_ml = int(data.get('volume_ml', 450))
    donation_date = data.get('donation_date') or datetime.now().strftime('%Y-%m-%d')
    notes = data.get('notes', '').strip()

    if not donor_id:
        return jsonify({'success': False, 'message': 'กรุณาระบุรหัสผู้บริจาค (donor_id)'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(row)
    
    if donor.weight < 45.0:
        conn.close()
        return jsonify({
            'success': False, 
            'message': f'ผู้บริจาคมีน้ำหนัก {donor.weight} กก. ซึ่งน้อยกว่าเกณฑ์ขั้นต่ำ 45 กิโลกรัม ไม่สามารถบริจาคเลือดได้'
        }), 400

    donation_result = donor.record_donation(conn, volume_ml=volume_ml, donation_date=donation_date, notes=notes)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'บันทึกการบริจาคเรียบร้อยแล้ว (สะสมรวม {donor.donation_count} ครั้ง)',
        'donor': donor.to_dict(),
        'result': donation_result
    })

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    conn = get_db_connection()
    inventory = get_blood_inventory_summary(conn)
    conn.close()

    return jsonify({'success': True, 'inventory': inventory})

@app.route('/api/check-eligibility', methods=['POST'])
def check_eligibility():
    data = request.json or {}
    weight = float(data.get('weight', 0))
    age = int(data.get('age', 0))

    health_form = {
        'sleep_hours': float(data.get('sleep_hours', 8)),
        'high_fat_meal': bool(data.get('high_fat_meal', False)),
        'water_intake': bool(data.get('water_intake', True)),
        'alcohol_24h': bool(data.get('alcohol_24h', False)),
        'smoking_1h': bool(data.get('smoking_1h', False))
    }

    dummy_donor = Donor(
        donor_id=0, id_card='', name='', age=age, gender='', weight=weight, blood_type=''
    )

    is_eligible, reasons = dummy_donor.can_donate(health_form)

    return jsonify({
        'is_eligible': is_eligible,
        'reasons': reasons
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Total Approved Donors
    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved'")
    total_donors = cursor.fetchone()[0]

    # 2. Total Approved Donations
    cursor.execute("SELECT SUM(donation_count) FROM donors WHERE status = 'approved'")
    total_donations = cursor.fetchone()[0] or 0

    # 3. Blood Inventory Summary & Volume
    inventory = get_blood_inventory_summary(conn)
    total_volume_ml = sum(item['volume_ml'] for item in inventory.values())
    if total_volume_ml == 0:
        cursor.execute('SELECT SUM(volume_ml) FROM donation_records')
        total_volume_ml = cursor.fetchone()[0] or (total_donations * 450)

    # 4. Blood Groups Breakdown (Approved Donors)
    cursor.execute("SELECT blood_type, COUNT(*) as count FROM donors WHERE status = 'approved' GROUP BY blood_type")
    blood_groups = {row['blood_type']: row['count'] for row in cursor.fetchall()}

    # 5. Milestone Breakdown (Exact Bands & Cumulative)
    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved' AND donation_count >= 1 AND donation_count < 7")
    band_1_6 = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved' AND donation_count >= 7 AND donation_count < 24")
    band_7_23 = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved' AND donation_count >= 24")
    band_24_plus = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved' AND donation_count >= 1")
    count_1 = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'approved' AND donation_count >= 7")
    count_7 = cursor.fetchone()[0]

    # 6. Pending Donors Count
    cursor.execute("SELECT COUNT(*) FROM donors WHERE status = 'pending'")
    pending_count = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'total_donors': total_donors,
        'total_donations': total_donations,
        'total_volume_liters': round(total_volume_ml / 1000.0, 1),
        'pending_count': pending_count,
        'blood_groups': blood_groups,
        'inventory': inventory,
        'milestones_achieved': {
            'count_1': count_1,
            'count_7': count_7,
            'count_24': band_24_plus,
            'band_1_6': band_1_6,
            'band_7_23': band_7_23,
            'band_24_plus': band_24_plus
        }
    })


@app.route('/api/admins', methods=['GET'])
def get_admins():
    conn = get_db_connection()
    admins = Admin.get_all(conn)
    conn.close()
    return jsonify({'success': True, 'count': len(admins), 'admins': admins})

@app.route('/api/admins', methods=['POST'])
def create_admin():
    data = request.json or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', '')).strip()
    name = str(data.get('name', '')).strip() or f"เจ้าหน้าที่ Admin ({username})"

    if not username or not password:
        return jsonify({'success': False, 'message': 'กรุณาระบุ Username และ Password'}), 400

    conn = get_db_connection()
    try:
        new_admin = Admin.create(conn, username, password, name)
        conn.close()
        return jsonify({
            'success': True,
            'message': f'สร้างบัญชี Admin Superuser ({username}) บันทึกลงฐานข้อมูล SQLite เรียบร้อยแล้ว',
            'admin': new_admin.to_dict()
        }), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': f'Username ({username}) มีอยู่ในฐานข้อมูลแล้ว'}), 400

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    donor_id = request.args.get('donor_id')
    status_filter = request.args.get('status')
    
    conn = get_db_connection()
    if donor_id and donor_id.isdigit():
        appointments = Appointment.get_by_donor(conn, int(donor_id))
    else:
        appointments = Appointment.get_all(conn, status_filter=status_filter)
    conn.close()
    
    return jsonify({'success': True, 'count': len(appointments), 'appointments': appointments})

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.json or {}
    donor_id = data.get('donor_id')
    appointment_date = data.get('appointment_date')
    time_slot = data.get('time_slot', '09:00 - 10:00')
    location = data.get('location', 'ศูนย์บริการโลหิตแห่งชาติ')
    donation_type = data.get('donation_type', 'บริจาคโลหิตรวม')
    purpose = data.get('purpose', 'บริจาคโลหิตทั่วไปเพื่อคลังสำรอง')
    notes = data.get('notes', '').strip()

    if not donor_id or not appointment_date or not time_slot:
        return jsonify({'success': False, 'message': 'กรุณาระบุผู้บริจาค วันที่นัดหมาย และช่วงเวลา'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'ไม่พบข้อมูลผู้บริจาคในระบบ'}), 404

    donor = Donor.from_row(row)
    next_info = donor.get_next_eligible_date()
    
    # Validate 90-day interval for ready date
    if not next_info['is_ready_today'] and str(appointment_date) < str(next_info['eligible_date']):
        conn.close()
        return jsonify({
            'success': False, 
            'message': f'ผู้บริจาคท่านนี้อยู่ระหว่างเว้นระยะบริจาค 90 วัน (สามารถนัดหมายบริจาคได้ตั้งแต่วันที่ {next_info["formatted_date"]} เป็นต้นไป)'
        }), 400

    app_obj = Appointment.create(conn, donor_id, appointment_date, time_slot, location, donation_type, purpose, notes)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'นัดหมายบริจาคสำเร็จ ({donation_type}) สำหรับคุณ {donor.name} ในวันที่ {appointment_date} ({time_slot})',
        'appointment': app_obj.to_dict()
    }), 201


@app.route('/api/appointments/<int:appointment_id>/status', methods=['PUT'])
def update_appointment_status(appointment_id):
    data = request.json or {}
    new_status = data.get('status', 'completed')

    conn = get_db_connection()
    Appointment.update_status(conn, appointment_id, new_status)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'อัปเดตสถานะรายการนัดหมาย #{appointment_id} เป็น {new_status} เรียบร้อยแล้ว'
    })


@app.route('/api/donors/due-notifications', methods=['GET'])
def get_due_notifications():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM donors WHERE status = 'approved' ORDER BY donor_id ASC")
    rows = cursor.fetchall()
    conn.close()

    ready_donors = []
    for r in rows:
        d = Donor.from_row(r)
        next_info = d.get_next_eligible_date()
        if next_info['is_ready_today']:
            ready_donors.append({
                'donor_id': d.donor_id,
                'name': d.name,
                'id_card': d.id_card,
                'blood_type': f"{d.blood_type}{d.rh_factor}",
                'phone': d.phone,
                'last_donation_date': d.last_donation_date or 'ยังไม่เคยบริจาค',
                'status_message': '✅ ครบรอบ 90 วันแล้ว - พร้อมบริจาคได้ทันที!'
            })

    return jsonify({
        'success': True,
        'count': len(ready_donors),
        'ready_donors': ready_donors
    })

@app.route('/api/admin/audit-logs', methods=['GET'])
def get_audit_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM activity_logs ORDER BY log_id DESC LIMIT 50")
        rows = cursor.fetchall()
    except Exception:
        # Table might not exist yet in Postgres/SQLite
        rows = []
    conn.close()


    logs = []
    for r in rows:
        logs.append({
            'log_id': r['log_id'],
            'admin_username': r['admin_username'],
            'action_type': r['action_type'],
            'details': r['details'],
            'timestamp': r['timestamp']
        })

    return jsonify({'success': True, 'logs': logs})

@app.route('/api/export/inventory-csv', methods=['GET'])
def export_inventory_csv():
    import io
    import csv
    conn = get_db_connection()
    inventory = get_blood_inventory_summary(conn)
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['หมู่เลือด', 'จำนวนถุงคงคลัง (ถุง)', 'ปริมาณรวม (มิลลิลิตร)', 'ปริมาณรวม (ลิตร)', 'สถานะความสมบูรณ์'])

    for b_type, info in inventory.items():
        writer.writerow([f"หมู่ {b_type}", info['bags'], info['volume_ml'], info['volume_liters'], info['status']])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv; charset=utf-8-sig',
        headers={"Content-disposition": "attachment; filename=blood_inventory_report.csv"}
    )

@app.route('/api/export/donors-csv', methods=['GET'])
def export_donors_csv():
    import io
    import csv
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM donors ORDER BY donor_id ASC")
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'เลขบัตรประชาชน', 'ชื่อ-นามสกุล', 'อายุ', 'เพศ', 'น้ำหนัก (kg)', 'หมู่เลือด', 'เบอร์โทรศัพท์', 'จำนวนครั้งบริจาค', 'วันบริจาคล่าสุด', 'สถานะ'])

    for r in rows:
        d = Donor.from_row(r)
        writer.writerow([d.donor_id, d.id_card, d.name, d.age, d.gender, d.weight, f"{d.blood_type}{d.rh_factor}", d.phone, d.donation_count, d.last_donation_date or '-', d.status])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv; charset=utf-8-sig',
        headers={"Content-disposition": "attachment; filename=donors_directory_report.csv"}
    )


@app.route('/api/appointments/<int:appointment_id>', methods=['DELETE'])
def delete_appointment(appointment_id):
    conn = get_db_connection()
    Appointment.delete(conn, appointment_id)
    conn.close()
    return jsonify({'success': True, 'message': 'ลบรายการนัดหมายเรียบร้อยแล้ว'})

if __name__ == '__main__':
    print("Starting Blood Donation System Web Server on http://127.0.0.1:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)

