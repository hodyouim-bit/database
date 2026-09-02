import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blood_donation.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Donors Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS donors (
        donor_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_card TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        weight REAL NOT NULL,
        blood_type TEXT NOT NULL,
        rh_factor TEXT NOT NULL DEFAULT '+',
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        donation_count INTEGER NOT NULL DEFAULT 0,
        last_donation_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Create Donation History Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS donation_records (
        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        donation_date TEXT NOT NULL,
        volume_ml INTEGER NOT NULL DEFAULT 450,
        hemoglobin_g_dl REAL DEFAULT 13.5,
        blood_pressure TEXT DEFAULT '120/80',
        pulse_rate INTEGER DEFAULT 75,
        staff_notes TEXT,
        FOREIGN KEY (donor_id) REFERENCES donors (donor_id) ON DELETE CASCADE
    );
    ''')

    # Create Health Screening Records Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS health_screenings (
        screening_id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        screening_date TEXT NOT NULL,
        sleep_hours REAL NOT NULL,
        high_fat_meal_free BOOLEAN NOT NULL,
        water_intake_ok BOOLEAN NOT NULL,
        alcohol_free_24h BOOLEAN NOT NULL,
        smoking_free_1h BOOLEAN NOT NULL,
        passed BOOLEAN NOT NULL,
        notes TEXT,
        FOREIGN KEY (donor_id) REFERENCES donors (donor_id) ON DELETE CASCADE
    );
    ''')

    conn.commit()
    
    # Seed default sample data if table is empty
    cursor.execute('SELECT COUNT(*) FROM donors')
    if cursor.fetchone()[0] == 0:
        seed_sample_data(conn)
        
    conn.close()

def seed_sample_data(conn):
    cursor = conn.cursor()
    sample_donors = [
        ('1100100234567', 'สมชาย รักชาติ', 28, 'ชาย', 68.5, 'O', '+', '081-234-5678', 'somchai@email.com', '123 ถ.สุขุมวิท กรุงเทพฯ', 6, '2026-05-10'),
        ('1100200345678', 'กานดา มีสุข', 32, 'หญิง', 52.0, 'A', '+', '089-876-5432', 'kanda@email.com', '45/1 ถ.แจ้งวัฒนะ นนทบุรี', 23, '2026-04-15'),
        ('1100300456789', 'ธนกร รัตนสว่าง', 45, 'ชาย', 75.0, 'B', '+', '086-555-1234', 'tanakorn@email.com', '88/2 ถ.มิตรภาพ โคราช', 49, '2026-03-20'),
        ('1100400567890', 'ปรียาพร พรหมดี', 22, 'หญิง', 48.0, 'AB', '-', '092-333-4455', 'preeyaporn@email.com', '12 หมู่ 4 จ.เชียงใหม่', 0, None),
        ('1100500678901', 'วิทวัส เจริญผล', 50, 'ชาย', 82.0, 'O', '+', '084-999-8877', 'wittawat@email.com', '99 ถ.ศรีนครินทร์ สมุทรปราการ', 99, '2026-06-01')
    ]
    
    for donor in sample_donors:
        cursor.execute('''
        INSERT INTO donors (id_card, name, age, gender, weight, blood_type, rh_factor, phone, email, address, donation_count, last_donation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', donor)
        
    conn.commit()
    print("Sample donor data seeded successfully.")


class Donor:
    """
    Donor OOP Class representing a blood donor entity.
    Encapsulates donor information, donation_count, health screening evaluation,
    milestone benefits calculations, and standard rewards.
    """
    
    MILESTONES = [
        {
            'count': 1,
            'title': 'บริจาคครั้งแรก (1 ครั้ง)',
            'badge_icon': '🏅',
            'benefits': [
                'ได้รับเข็มกลัดที่ระลึกสำหรับผู้บริจาคหน้าใหม่',
                'ได้รับบัตรประจำตัวผู้บริจาคโลหิต',
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 1'
            ]
        },
        {
            'count': 7,
            'title': 'บริจาคครบ 7 ครั้ง',
            'badge_icon': '🎗️',
            'benefits': [
                'สิทธิในการตรวจสุขภาพพื้นฐานฟรี (ตามเงื่อนไขสถานพยาบาล)',
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 7'
            ]
        },
        {
            'count': 16,
            'title': 'บริจาคครบ 16 ครั้ง',
            'badge_icon': '🥉',
            'benefits': [
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 16'
            ]
        },
        {
            'count': 24,
            'title': 'บริจาคครบ 24 ครั้งขึ้นไป',
            'badge_icon': '🥈',
            'benefits': [
                'สิทธิการช่วยเหลือค่ารักษาพยาบาล (เช่น ยกเว้นค่าห้อง หรือค่ารักษาประเภทผู้ป่วยใน ตามเงื่อนไขสถานพยาบาลที่เข้าร่วม)',
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 24'
            ]
        },
        {
            'count': 36,
            'title': 'บริจาคครบ 36 ครั้ง',
            'badge_icon': '🥇',
            'benefits': [
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 36'
            ]
        },
        {
            'count': 50,
            'title': 'บริจาคครบ 50 ครั้ง',
            'badge_icon': '💎',
            'benefits': [
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 50'
            ]
        },
        {
            'count': 100,
            'title': 'บริจาคครบ 100 ครั้ง',
            'badge_icon': '👑',
            'benefits': [
                'ได้รับเข็มเชิดชูเกียรติ ชั้นที่ 100'
            ]
        }
    ]

    def __init__(self, donor_id, id_card, name, age, gender, weight, blood_type, rh_factor='+', 
                 phone='', email='', address='', donation_count=0, last_donation_date=None, created_at=None):
        self.donor_id = donor_id
        self.id_card = id_card
        self.name = name
        self.age = int(age)
        self.gender = gender
        self.weight = float(weight)
        self.blood_type = blood_type
        self.rh_factor = rh_factor
        self.phone = phone
        self.email = email
        self.address = address
        self.donation_count = int(donation_count)
        self.last_donation_date = last_donation_date
        self.created_at = created_at

    @classmethod
    def from_row(cls, row):
        if not row:
            return None
        return cls(
            donor_id=row['donor_id'],
            id_card=row['id_card'],
            name=row['name'],
            age=row['age'],
            gender=row['gender'],
            weight=row['weight'],
            blood_type=row['blood_type'],
            rh_factor=row['rh_factor'],
            phone=row['phone'],
            email=row['email'],
            address=row['address'],
            donation_count=row['donation_count'],
            last_donation_date=row['last_donation_date'],
            created_at=row['created_at']
        )

    def can_donate(self, health_form=None):
        """
        Check donor eligibility based on weight, age, and health history form.
        """
        reasons = []
        is_eligible = True

        # Weight check (Must be >= 45 kg)
        if self.weight < 45.0:
            is_eligible = False
            reasons.append(f"น้ำหนักตัวต้องไม่น้อยกว่า 45 กิโลกรัม (ปัจจุบัน {self.weight} กก.)")

        # Age check (17-70 years)
        if self.age < 17 or self.age > 70:
            is_eligible = False
            reasons.append(f"อายุต้องอยู่ระหว่าง 17 - 70 ปี (ปัจจุบัน {self.age} ปี)")

        # Health screening form check if provided
        if health_form:
            sleep_hours = float(health_form.get('sleep_hours', 0))
            if sleep_hours < 5.0:
                is_eligible = False
                reasons.append("ต้องนอนหลับพักผ่อนอย่างน้อย 5 ชั่วโมงก่อนบริจาค")

            if health_form.get('high_fat_meal', False):
                is_eligible = False
                reasons.append("ต้องงดอาหารไขมันสูง (เช่น ข้าวขาหมู ข้าวมันไก่ แกงกะทิ ของทอด) ภายใน 6 ชั่วโมงก่อนบริจาค")

            if not health_form.get('water_intake', True):
                is_eligible = False
                reasons.append("ควรดื่มน้ำเปล่า 3-4 แก้ว ก่อนบริจาคประมาณ 30 นาที")

            if health_form.get('alcohol_24h', False):
                is_eligible = False
                reasons.append("ต้องงดเครื่องดื่มแอลกอฮอล์ทุกชนิดอย่างน้อย 24 ชั่วโมงก่อนบริจาค")

            if health_form.get('smoking_1h', False):
                is_eligible = False
                reasons.append("ต้องงดสูบบุหรี่ก่อนและหลังบริจาคอย่างน้อย 1 ชั่วโมง")

        return is_eligible, reasons

    def get_milestone_benefits(self):
        """
        Calculates and returns all earned milestone benefits & honor pins based on self.donation_count.
        """
        earned_milestones = []
        for milestone in self.MILESTONES:
            if self.donation_count >= milestone['count']:
                earned_milestones.append({
                    'count': milestone['count'],
                    'title': milestone['title'],
                    'badge_icon': milestone['badge_icon'],
                    'benefits': milestone['benefits'],
                    'unlocked': True
                })
            else:
                earned_milestones.append({
                    'count': milestone['count'],
                    'title': milestone['title'],
                    'badge_icon': milestone['badge_icon'],
                    'benefits': milestone['benefits'],
                    'unlocked': False
                })
        return earned_milestones

    def get_next_milestone_progress(self):
        """
        Calculates the progress percentage and remaining donations to reach the next milestone goal.
        """
        next_milestone = None
        for m in self.MILESTONES:
            if self.donation_count < m['count']:
                next_milestone = m
                break
                
        if not next_milestone:
            return {
                'target_count': 100,
                'remaining': 0,
                'progress_percent': 100.0,
                'target_title': 'สูงสุด (บรรลุ 100 ครั้งแล้ว)',
                'badge_icon': '👑'
            }

        prev_count = 0
        for m in self.MILESTONES:
            if m['count'] < next_milestone['count']:
                prev_count = m['count']

        remaining = next_milestone['count'] - self.donation_count
        span = next_milestone['count'] - prev_count
        progress_in_span = self.donation_count - prev_count
        percent = round(min(100.0, max(0.0, (progress_in_span / span) * 100.0)), 1)

        return {
            'target_count': next_milestone['count'],
            'remaining': remaining,
            'progress_percent': percent,
            'target_title': next_milestone['title'],
            'badge_icon': next_milestone['badge_icon']
        }

    def get_standard_rewards(self):
        """
        Returns standard basic rewards received every time a donation is completed.
        """
        return [
            {
                'category': 'อาหารและเครื่องดื่ม',
                'icon': '☕',
                'description': 'บริการน้ำดื่ม ชา กาแฟ และขนมว่าง ทั้งก่อนและหลังการบริจาค'
            },
            {
                'category': 'ยาบำรุงเลือด',
                'icon': '💊',
                'description': 'ได้รับยาธาตุเหล็ก (Iron Supplement) เพื่อนำไปรับประทานบำรุงเลือดหลังบริจาค'
            },
            {
                'category': 'ของที่ระลึก',
                'icon': '🎁',
                'description': 'เสื้อยืด กระเป๋า หรือของพรีเมียมตามแคมเปญพิเศษประจำช่วงเวลา'
            }
        ]

    def record_donation(self, db_conn, volume_ml=450, donation_date=None, notes=''):
        """
        Records a new blood donation, updates donation_count, and saves record to SQLite DB.
        """
        if not donation_date:
            donation_date = datetime.now().strftime('%Y-%m-%d')
            
        cursor = db_conn.cursor()
        
        # Insert into donation_records
        cursor.execute('''
        INSERT INTO donation_records (donor_id, donation_date, volume_ml, staff_notes)
        VALUES (?, ?, ?, ?)
        ''', (self.donor_id, donation_date, volume_ml, notes))
        
        # Increment donation_count
        self.donation_count += 1
        self.last_donation_date = donation_date
        
        cursor.execute('''
        UPDATE donors 
        SET donation_count = ?, last_donation_date = ?
        WHERE donor_id = ?
        ''', (self.donation_count, self.last_donation_date, self.donor_id))
        
        db_conn.commit()
        
        # Check newly unlocked milestone
        newly_unlocked = [m for m in self.MILESTONES if m['count'] == self.donation_count]
        
        return {
            'new_donation_count': self.donation_count,
            'donation_date': donation_date,
            'newly_unlocked_milestone': newly_unlocked[0] if newly_unlocked else None,
            'standard_rewards': self.get_standard_rewards()
        }

    def to_dict(self):
        return {
            'donor_id': self.donor_id,
            'id_card': self.id_card,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'weight': self.weight,
            'blood_type': self.blood_type,
            'rh_factor': self.rh_factor,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'donation_count': self.donation_count,
            'last_donation_date': self.last_donation_date,
            'created_at': self.created_at,
            'milestone_benefits': self.get_milestone_benefits(),
            'next_milestone': self.get_next_milestone_progress(),
            'standard_rewards': self.get_standard_rewards()
        }
