from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime
from models import get_db_connection, init_db, Donor, get_blood_inventory_summary

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Ensure Database is initialized on startup
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/donors', methods=['GET'])
def get_donors():
    search_q = request.args.get('q', '').strip()
    blood_type_filter = request.args.get('blood_type', '').strip()

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

    query += ' ORDER BY donation_count DESC, donor_id DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    donors = [Donor.from_row(r).to_dict() for r in rows]
    return jsonify({'success': True, 'count': len(donors), 'donors': donors})

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

    # Get history
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

    if not id_card or not name or not phone:
        return jsonify({'success': False, 'message': 'กรุณากรอกเลขบัตรประชาชน ชื่อ-นามสกุล และเบอร์โทรศัพท์'}), 400

    # Create donor object instance to evaluate eligibility
    temp_donor = Donor(
        donor_id=None,
        id_card=id_card,
        name=name,
        age=age,
        gender=gender,
        weight=weight,
        blood_type=blood_type,
        rh_factor=rh_factor,
        phone=phone,
        email=email,
        address=address
    )

    # Health screening parameters
    health_form = {
        'sleep_hours': data.get('sleep_hours', 8),
        'high_fat_meal': data.get('high_fat_meal', False),
        'water_intake': data.get('water_intake', True),
        'alcohol_24h': data.get('alcohol_24h', False),
        'smoking_1h': data.get('smoking_1h', False)
    }

    is_eligible, reasons = temp_donor.can_donate(health_form)

    # Save donor to Database
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
        INSERT INTO donors (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, donation_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address))
        
        donor_id = cursor.lastrowid
        
        # Log health screening entry
        cursor.execute('''
        INSERT INTO health_screenings (donor_id, screening_date, sleep_hours, high_fat_meal_free, water_intake_ok, alcohol_free_24h, smoking_free_1h, passed, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            donor_id, 
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            health_form['sleep_hours'],
            not health_form['high_fat_meal'],
            health_form['water_intake'],
            not health_form['alcohol_24h'],
            not health_form['smoking_1h'],
            is_eligible,
            "; ".join(reasons) if not is_eligible else "ผ่านการคัดกรองสมบูรณ์"
        ))
        
        conn.commit()
        
        cursor.execute('SELECT * FROM donors WHERE donor_id = ?', (donor_id,))
        new_row = cursor.fetchone()
        created_donor = Donor.from_row(new_row).to_dict()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'ลงทะเบียนผู้บริจาคสำเร็จ',
            'is_eligible_today': is_eligible,
            'eligibility_reasons': reasons,
            'donor': created_donor
        }), 201

    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': 'เลขบัตรประชาชนนี้ถูกลงทะเบียนไว้ในระบบแล้ว'}), 400

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
    
    # Check weight eligibility before recording donation
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

    cursor.execute('SELECT COUNT(*) FROM donors')
    total_donors = cursor.fetchone()[0]

    cursor.execute('SELECT SUM(donation_count) FROM donors')
    total_donations = cursor.fetchone()[0] or 0

    cursor.execute('SELECT SUM(volume_ml) FROM donation_records')
    total_volume_ml = cursor.fetchone()[0] or (total_donations * 450)

    # Blood group distribution
    cursor.execute('SELECT blood_type, COUNT(*) as count FROM donors GROUP BY blood_type')
    blood_groups = {row['blood_type']: row['count'] for row in cursor.fetchall()}

    inventory = get_blood_inventory_summary(conn)

    # Milestone stats
    cursor.execute('SELECT COUNT(*) FROM donors WHERE donation_count >= 1')
    milestone_1 = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM donors WHERE donation_count >= 7')
    milestone_7 = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM donors WHERE donation_count >= 24')
    milestone_24 = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'total_donors': total_donors,
        'total_donations': total_donations,
        'total_volume_liters': round(total_volume_ml / 1000.0, 1),
        'blood_groups': blood_groups,
        'inventory': inventory,
        'milestones_achieved': {
            'count_1': milestone_1,
            'count_7': milestone_7,
            'count_24': milestone_24
        }
    })

if __name__ == '__main__':
    print("Starting Blood Donation System Web Server on http://127.0.0.1:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)
