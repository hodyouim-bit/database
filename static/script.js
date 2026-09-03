/**
 * Blood Donation System v2.0 - Frontend JavaScript Controller
 */

let activeModalDonorId = null;
let currentRole = 'guest'; // 'guest', 'user' (read-only), 'admin'

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initRoleAuth();
    initSignUpForm();
    initTabNavigation();
    initQuickEligibilityChecker();
    initRecommendationSystem();
    initRegistrationForm();
    initRecordDonationForm();
    initMilestoneLookup();
    initDonorsDirectory();
    initEditDonorForm();
    initAppointmentBooking();

    // Initial data load
    loadDashboardStats();
    loadBloodInventory();
    loadDonorsList();
    loadPendingDonors();
    loadPendingDonationRecords();
    populateDonorSelects();

    // Real-time Live Polling Auto-Refresh (every 5 seconds)
    setInterval(() => {
        loadDashboardStats();
        loadBloodInventory();
    }, 5000);

    const recDateInput = document.getElementById('rec-date');
    if (recDateInput) {
        recDateInput.value = new Date().toISOString().split('T')[0];
    }
});



/* ==========================================================================
   1. Dual-Role Authentication & Session Management
   ========================================================================== */
function initRoleAuth() {
    const savedRole = localStorage.getItem('userRole') || 'guest';
    const savedName = localStorage.getItem('userName') || '';

    setRoleState(savedRole, savedName);

    // General User Read-Only Login Form
    const userForm = document.getElementById('user-login-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputVal = document.getElementById('user-idcard-input').value.trim();
            const password = document.getElementById('user-pass-input').value.trim();

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login_type: 'user',
                        username: inputVal,
                        id_card: inputVal,
                        password: password
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    localStorage.setItem('userRole', 'user');
                    localStorage.setItem('userName', data.user.name);
                    localStorage.setItem('userIdCard', data.user.id_card || inputVal);
                    setRoleState('user', data.user.name);
                    closeLoginModal();
                    showToast(`👤 ${data.message}`);
                    loadDonorsList();
                } else {
                    showToast(`❌ ${data.message || 'ข้อมูลการเข้าสู่ระบบผู้ใช้ทั่วไปไม่ถูกต้อง'}`);
                }
            } catch (err) {
                console.error('User login error:', err);
                showToast('❌ ไม่สามารถเข้าสู่ระบบผู้ใช้ทั่วไปได้');
            }
        });
    }

    // Admin Staff Login Form
    const adminForm = document.getElementById('admin-login-form');
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-user-input').value.trim();
            const password = document.getElementById('admin-pass-input').value.trim();

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login_type: 'admin',
                        username: username,
                        password: password
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    localStorage.setItem('userRole', 'admin');
                    localStorage.setItem('userName', data.user.name);
                    localStorage.setItem('userIdCard', data.user.id_card || username);
                    setRoleState('admin', data.user.name);
                    closeLoginModal();
                    showToast(`🔑 ${data.message}`);
                    loadDonorsList();
                    loadPendingDonors();
                } else {
                    showToast(`❌ ${data.message || 'ชื่อผู้ใช้หรือรหัสผ่าน Admin ไม่ถูกต้อง'}`);
                }
            } catch (err) {
                console.error('Admin login error:', err);
                showToast('❌ ไม่สามารถเข้าสู่ระบบ Admin ได้');
            }
        });
    }
}

function initSignUpForm() {
    const signupForm = document.getElementById('user-signup-form');
    if (!signupForm) return;

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idCard = document.getElementById('signup-id-card').value.trim();
        const name = document.getElementById('signup-name').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();

        if (idCard.length !== 13) {
            showToast('⚠️ เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
            return;
        }

        const payload = {
            id_card: idCard,
            name: name,
            password: password,
            phone: phone
        };

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`🎉 สมัครสมาชิกผู้ใช้งานสำเร็จ!`);
                signupForm.reset();
                
                // Auto-login user immediately
                localStorage.setItem('userRole', 'user');
                localStorage.setItem('userName', name);
                localStorage.setItem('userIdCard', data.user?.id_card || idCard);
                setRoleState('user', name);
                closeLoginModal();
                showToast(`👤 เข้าสู่ระบบในฐานะคุณ ${name} เรียบร้อยแล้ว! (หากต้องการบริจาคโลหิต สามารถกรอกแบบฟอร์มลงทะเบียนได้)`);

                loadDashboardStats();
            } else {
                showToast(`❌ ${data.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก'}`);
            }
        } catch (err) {
            console.error('Sign up error:', err);
            showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    });
}

function setRoleState(role, displayName = '') {
    currentRole = role;
    const loginBtn = document.getElementById('open-login-btn');
    const userBadge = document.getElementById('user-status-badge');
    const adminBadge = document.getElementById('admin-status-badge');
    const nameSpan = document.getElementById('user-display-name');
    const pendingCard = document.getElementById('pending-approval-card');
    const pendingDonationsCard = document.getElementById('pending-donations-approval-card');

    if (role === 'admin') {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userBadge) userBadge.classList.add('hidden');
        if (adminBadge) adminBadge.classList.remove('hidden');
        if (pendingCard) pendingCard.classList.remove('hidden');
        if (pendingDonationsCard) pendingDonationsCard.classList.remove('hidden');
        const adminNameSpan = document.getElementById('admin-display-name');
        if (adminNameSpan) adminNameSpan.textContent = displayName || '6812732101';
    } else if (role === 'user') {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (adminBadge) adminBadge.classList.add('hidden');
        if (userBadge) userBadge.classList.remove('hidden');
        if (pendingCard) pendingCard.classList.add('hidden');
        if (pendingDonationsCard) pendingDonationsCard.classList.add('hidden');
        if (nameSpan) nameSpan.textContent = displayName || 'ผู้ใช้งานทั่วไป';
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userBadge) userBadge.classList.add('hidden');
        if (adminBadge) adminBadge.classList.add('hidden');
        if (pendingCard) pendingCard.classList.add('hidden');
        if (pendingDonationsCard) pendingDonationsCard.classList.add('hidden');
    }
}

function openLoginModal() {
    document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

function switchLoginTab(tabType) {
    const userBtn = document.getElementById('tab-user-btn');
    const signupBtn = document.getElementById('tab-signup-btn');
    const adminBtn = document.getElementById('tab-admin-btn');
    
    const userForm = document.getElementById('user-login-form');
    const signupForm = document.getElementById('user-signup-form');
    const adminForm = document.getElementById('admin-login-form');

    userBtn.classList.remove('active');
    signupBtn.classList.remove('active');
    adminBtn.classList.remove('active');

    userForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    adminForm.classList.add('hidden');

    if (tabType === 'signup') {
        signupBtn.classList.add('active');
        signupForm.classList.remove('hidden');
    } else if (tabType === 'admin') {
        adminBtn.classList.add('active');
        adminForm.classList.remove('hidden');
    } else {
        userBtn.classList.add('active');
        userForm.classList.remove('hidden');
    }
}

function logoutRole() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    setRoleState('guest');
    showToast('👋 ออกจากระบบเรียบร้อยแล้ว');
    loadDonorsList();
    loadPendingDonors();
}

/* ==========================================================================
   2. Theme Toggle & Navigation
   ========================================================================== */
function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        btn.textContent = isDark ? '☀️' : '🌙';
    });
}

function initTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    if (tabId === 'dashboard') loadDashboardStats();
    if (tabId === 'inventory') loadBloodInventory();
    if (tabId === 'recommendations') loadRecommendationsTab();
    if (tabId === 'appointments') {
        loadAppointmentsList();
        const savedUsername = localStorage.getItem('userName');
        if (savedUsername && savedUsername.length === 13) {
            const appInput = document.getElementById('app-idcard-input');
            if (appInput) {
                appInput.value = savedUsername;
                searchDonorByIdCardForAppointment();
            }
        }
    }
    if (tabId === 'record') {
        const savedUsername = localStorage.getItem('userName');
        if (savedUsername && savedUsername.length === 13) {
            const recInput = document.getElementById('rec-idcard-input');
            if (recInput) {
                recInput.value = savedUsername;
                searchDonorByIdCardForRecord();
            }
        }
    }
    if (tabId === 'milestones') {
        const savedUsername = localStorage.getItem('userName');
        if (savedUsername && savedUsername.length === 13) {
            const lookupInput = document.getElementById('lookup-idcard-input');
            if (lookupInput) {
                lookupInput.value = savedUsername;
                searchDonorByIdCardForMilestones();
            }
        }
    }
    if (tabId === 'donors-list') {
        loadDonorsList();
        loadPendingDonors();
        loadPendingDonationRecords();
    }
    if (tabId === 'stations-map') renderStationsList();
    if (tabId === 'audit-logs') loadAuditLogs();
    if (tabId === 'record' || tabId === 'milestones' || tabId === 'appointments') populateDonorSelects();
}





/* ==========================================================================
   3. Smart Recommendation Engine Controller
   ========================================================================== */
function initRecommendationSystem() {
    const weightInput = document.getElementById('recom-weight-input');
    const bloodSelect = document.getElementById('recom-blood-select');

    if (weightInput) weightInput.addEventListener('input', fetchHealthRecommendations);
    if (bloodSelect) bloodSelect.addEventListener('change', fetchHealthRecommendations);
}

function loadRecommendationsTab() {
    fetchHealthRecommendations();
    fetchInventoryRecommendations();
}

async function fetchHealthRecommendations() {
    const weightVal = parseFloat(document.getElementById('recom-weight-input')?.value || 60);
    const bloodVal = document.getElementById('recom-blood-select')?.value || 'O';

    try {
        const res = await fetch('/api/recommendations/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: weightVal, blood_type: bloodVal })
        });
        const data = await res.json();

        if (data && data.success) {
            document.getElementById('recom-water-val').textContent = `${data.water_recommendation_ml} ml`;
            document.getElementById('recom-water-desc').textContent = data.advice.before;

            const foodsList = document.getElementById('recom-foods-list');
            if (foodsList) {
                let html = '';
                data.recommended_foods.forEach(item => {
                    html += `
                        <div class="reward-item">
                            <div class="reward-icon">${item.icon}</div>
                            <div class="reward-desc">
                                <h4>${item.name}</h4>
                                <p>${item.benefit}</p>
                            </div>
                        </div>
                    `;
                });
                foodsList.innerHTML = html;
            }
        }
    } catch (err) {
        console.error('Error fetching health recommendations:', err);
    }
}

async function fetchInventoryRecommendations() {
    const urgentBox = document.getElementById('urgent-recom-box');
    if (!urgentBox) return;

    try {
        const res = await fetch('/api/recommendations/inventory');
        const data = await res.json();

        if (data && data.success) {
            if (data.urgent_blood_groups.length === 0) {
                urgentBox.className = 'recom-alert-box';
                urgentBox.style.background = '#d1fae5';
                urgentBox.style.borderColor = '#34d399';
                urgentBox.style.color = '#065f46';
                urgentBox.innerHTML = `
                    <h4 style="margin-bottom: 4px;">✅ ปริมาณคลังโลหิตอยู่ในเกณฑ์ปกติทุกหมู่เลือด</h4>
                    <p style="font-size: 0.9rem;">คลังโลหิตสำรองเพียงพอต่อการจ่ายให้ผู้ป่วยฉุกเฉิน</p>
                `;
            } else {
                urgentBox.className = 'recom-alert-box';
                urgentBox.style.background = 'rgba(254, 226, 226, 0.7)';
                urgentBox.style.borderColor = '#fca5a5';
                urgentBox.style.color = '#991b1b';

                let urgentMsg = `<h4>🚨 ${data.recommendation_summary}</h4><ul style="margin-top: 8px; padding-left: 20px;">`;
                data.urgent_blood_groups.forEach(u => {
                    urgentMsg += `<li>${u.message}</li>`;
                });
                urgentMsg += `</ul>`;

                if (data.urgent_ready_donors.length > 0) {
                    urgentMsg += `<p style="margin-top: 10px; font-weight: 600;">รายชื่อผู้บริจาคหมู่เลือดที่ขาดแคลนและพร้อมบริจาควันนี้:</p><ul style="padding-left: 20px;">`;
                    data.urgent_ready_donors.forEach(d => {
                        urgentMsg += `<li><strong>#${d.donor_id} คุณ${d.name}</strong> (หมู่ ${d.blood_type}${d.rh_factor}) - โทร: ${d.phone}</li>`;
                    });
                    urgentMsg += `</ul>`;
                }

                urgentBox.innerHTML = urgentMsg;
            }
        }
    } catch (err) {
        console.error('Error fetching inventory recommendations:', err);
    }
}

/* ==========================================================================
   4. Dashboard & Inventory Data Loaders
   ========================================================================== */
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (data) {
            document.getElementById('stat-total-donors').textContent = data.total_donors || 0;
            document.getElementById('stat-total-donations').textContent = data.total_donations || 0;
            document.getElementById('stat-total-volume').textContent = (data.total_volume_liters || 0) + ' L';
            document.getElementById('stat-milestone-24').textContent = data.milestones_achieved?.count_24 || 0;
            
            const pendingNavBadge = document.getElementById('nav-pending-badge');
            if (pendingNavBadge) {
                if (data.pending_count > 0) {
                    pendingNavBadge.textContent = data.pending_count;
                    pendingNavBadge.classList.remove('hidden');
                } else {
                    pendingNavBadge.classList.add('hidden');
                }
            }

            // Render Chart.js Visualizations & Load Notifications
            renderDashboardCharts(data);
            loadDueNotifications();
        }

    } catch (err) {

        console.error('Error loading dashboard stats:', err);
    }
}

async function loadBloodInventory() {
    const container = document.getElementById('inventory-container');
    if (!container) return;

    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();

        if (data && data.inventory) {
            let html = '';
            for (const [bloodType, info] of Object.entries(data.inventory)) {
                const statusClass = info.bags < 5 ? 'low' : (info.bags >= 15 ? 'optimal' : 'normal');
                html += `
                    <div class="inv-card">
                        <div class="inv-header">
                            <span class="blood-badge ${bloodType}">หมู่ ${bloodType}</span>
                            <span class="inv-status ${statusClass}">${info.status}</span>
                        </div>
                        <div class="inv-body">
                            <h3>${info.bags} ถุง</h3>
                            <p>${info.volume_ml} มิลลิลิตร (${info.volume_liters || 0} ลิตร)</p>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading blood inventory:', err);
    }
}

/* ==========================================================================
   5. Quick Eligibility Checker
   ========================================================================== */
function initQuickEligibilityChecker() {
    const weightInput = document.getElementById('chk-weight');
    const ageInput = document.getElementById('chk-age');
    const checkboxes = document.querySelectorAll('#quick-check-form input[type="checkbox"]');

    const updateCheck = () => {
        const weight = parseFloat(weightInput.value) || 0;
        const age = parseInt(ageInput.value) || 0;
        const sleep = document.getElementById('chk-sleep').checked ? 8 : 4;
        const highFat = !document.getElementById('chk-fat-free').checked;
        const water = document.getElementById('chk-water').checked;
        const alcohol = !document.getElementById('chk-alcohol').checked;
        const smoking = !document.getElementById('chk-smoking').checked;

        const resultBox = document.getElementById('check-result-box');
        const resultStatus = document.getElementById('result-status');
        const resultReasons = document.getElementById('result-reasons');

        let reasons = [];

        if (weight < 45.0) {
            reasons.push(`น้ำหนักตัวต้องไม่น้อยกว่า 45 กก. (ปัจจุบัน ${weight} กก.)`);
        }
        if (age < 17 || age > 70) {
            reasons.push(`อายุต้องอยู่ระหว่าง 17-70 ปี (ปัจจุบัน ${age} ปี)`);
        }
        if (sleep < 5) {
            reasons.push('ต้องนอนหลับพักผ่อนอย่างน้อย 5 ชั่วโมง');
        }
        if (highFat) {
            reasons.push('ต้องงดอาหารไขมันสูง (ข้าวขาหมู, ข้าวมันไก่, แกงกะทิ, ของทอด) ใน 6 ชม.');
        }
        if (!water) {
            reasons.push('ควรดื่มน้ำเปล่า 3-4 แก้ว ก่อนบริจาค 30 นาที');
        }
        if (alcohol) {
            reasons.push('ต้องงดเครื่องดื่มแอลกอฮอล์ครบ 24 ชั่วโมง');
        }
        if (smoking) {
            reasons.push('ต้องงดสูบบุหรี่ก่อนและหลังบริจาคอย่างน้อย 1 ชั่วโมง');
        }

        if (reasons.length === 0) {
            resultBox.className = 'result-box pass';
            resultBox.querySelector('.result-icon').textContent = '✅';
            resultStatus.textContent = 'คุณมีความพร้อมในการบริจาคเลือด!';
            resultReasons.textContent = 'สุขภาพสมบูรณ์และปฏิบัติตามเกณฑ์ข้อกำหนดถูกต้อง';
        } else {
            resultBox.className = 'result-box fail';
            resultBox.querySelector('.result-icon').textContent = '⚠️';
            resultStatus.textContent = 'ยังไม่พร้อมบริจาคในวันนี้';
            resultReasons.textContent = reasons.join(' • ');
        }
    };

    weightInput.addEventListener('input', updateCheck);
    ageInput.addEventListener('input', updateCheck);
    checkboxes.forEach(cb => cb.addEventListener('change', updateCheck));

    updateCheck();
}

/* ==========================================================================
   6. Registration & Record Donation
   ========================================================================== */
function initRegistrationForm() {
    const regForm = document.getElementById('register-donor-form');
    const weightInput = document.getElementById('reg-weight');
    const weightWarn = document.getElementById('weight-warn');

    weightInput.addEventListener('input', () => {
        const val = parseFloat(weightInput.value) || 0;
        if (val > 0 && val < 45.0) {
            weightWarn.classList.remove('hidden');
        } else {
            weightWarn.classList.add('hidden');
        }
    });

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idCard = document.getElementById('reg-id-card').value.trim();
        const name = document.getElementById('reg-name').value.trim();
        const age = parseInt(document.getElementById('reg-age').value);
        const gender = document.getElementById('reg-gender').value;
        const weight = parseFloat(document.getElementById('reg-weight').value);
        const bloodType = document.getElementById('reg-blood-type').value;
        const rhFactor = document.getElementById('reg-rh').value;
        const phone = document.getElementById('reg-phone').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const address = document.getElementById('reg-address').value.trim();

        if (weight < 45.0) {
            showToast('⚠️ ไม่สามารถลงทะเบียนได้: น้ำหนักตัวต้องไม่น้อยกว่า 45 กิโลกรัม');
            return;
        }

        const payload = {
            id_card: idCard, name: name, age: age, gender: gender, weight: weight,
            blood_type: bloodType, rh_factor: rhFactor, phone: phone, email: email, address: address,
            sleep_hours: document.getElementById('reg-sleep').checked ? 8 : 4,
            high_fat_meal: document.getElementById('reg-fat-meal').checked,
            water_intake: document.getElementById('reg-water').checked,
            alcohol_24h: document.getElementById('reg-alcohol').checked,
            smoking_1h: document.getElementById('reg-smoking').checked
        };

        try {
            const res = await fetch('/api/donors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.success) {
                showToast(`📝 บันทึกลงทะเบียนเรียบร้อยแล้ว รอเจ้าหน้าที่ Admin ตรวจสอบและยืนยันข้อมูล`);
                regForm.reset();
                loadDashboardStats();
                loadPendingDonors();
                populateDonorSelects();
                switchTab('donors-list');
            } else {
                showToast(`❌ ${data.message || 'เกิดข้อผิดพลาดในการลงทะเบียน'}`);
            }
        } catch (err) {
            console.error('Registration error:', err);
            showToast('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
    });
}

let allDonorsCache = [];

async function populateDonorSelects() {
    try {
        const response = await fetch('/api/donors');
        const data = await response.json();
        if (data && data.donors) {
            const approvedDonors = data.donors.filter(d => d.status === 'approved');
            approvedDonors.sort((a, b) => a.donor_id - b.donor_id);
            allDonorsCache = data.donors;

            const recSelect = document.getElementById('rec-donor-select');
            const lookupSelect = document.getElementById('lookup-donor-select');
            const appSelect = document.getElementById('app-donor-select');

            let optionsHtml = '<option value="">-- กรุณาเลือกผู้บริจาค --</option>';
            approvedDonors.forEach(d => {
                optionsHtml += `<option value="${d.donor_id}">#${d.donor_id} คุณ${d.name} | เลขบัตรประชาชน: ${d.id_card} | อายุ ${d.age} ปี | เพศ ${d.gender} | (หมู่ ${d.blood_type}${d.rh_factor})</option>`;
            });

            if (recSelect) recSelect.innerHTML = optionsHtml;
            if (lookupSelect) lookupSelect.innerHTML = optionsHtml;
            if (appSelect) appSelect.innerHTML = optionsHtml;

        }
    } catch (err) {
        console.error('Error fetching donors list for select:', err);
    }
}

function searchDonorByIdCardForRecord() {
    const idCardInput = document.getElementById('rec-idcard-input');
    const recSelect = document.getElementById('rec-donor-select');
    if (!idCardInput || !recSelect) return;

    const idCard = idCardInput.value.trim();
    if (!idCard) return;

    const donor = allDonorsCache.find(d => String(d.id_card).trim() === idCard);
    if (donor) {
        recSelect.value = donor.donor_id;
        recSelect.dispatchEvent(new Event('change'));
    } else {
        recSelect.value = '';
        recSelect.dispatchEvent(new Event('change'));
        showToast(`❌ ไม่พบข้อมูลผู้บริจาคเลขบัตรประชาชน ${idCard}`);
    }
}

function initRecordDonationForm() {
    const recSelect = document.getElementById('rec-donor-select');
    const recIdCardInput = document.getElementById('rec-idcard-input');
    const previewCard = document.getElementById('donor-preview-card');
    const recForm = document.getElementById('record-donation-form');

    if (recIdCardInput) {
        recIdCardInput.addEventListener('input', () => {
            if (recIdCardInput.value.trim().length === 13) {
                searchDonorByIdCardForRecord();
            }
        });
    }

    recSelect.addEventListener('change', () => {
        const donorId = parseInt(recSelect.value);
        const donor = allDonorsCache.find(d => d.donor_id === donorId);

        if (donor) {
            document.getElementById('prev-name').textContent = `คุณ${donor.name} (รหัสระบบ #${donor.donor_id})`;
            if (document.getElementById('prev-idcard')) document.getElementById('prev-idcard').textContent = donor.id_card;
            if (document.getElementById('prev-age')) document.getElementById('prev-age').textContent = donor.age;
            if (document.getElementById('prev-gender')) document.getElementById('prev-gender').textContent = donor.gender;
            document.getElementById('prev-blood').textContent = `${donor.blood_type}${donor.rh_factor}`;
            document.getElementById('prev-count').textContent = donor.donation_count;
            document.getElementById('prev-weight').textContent = donor.weight;
            document.getElementById('prev-date').textContent = donor.last_donation_date || 'ยังไม่เคยบริจาค';

            const next = donor.next_eligible;
            const tag = document.getElementById('prev-eligibility-tag');
            if (next.is_ready_today) {
                tag.className = 'eligibility-tag ready-badge';
                tag.textContent = '✅ พร้อมบริจาคโลหิตได้ในวันนี้ (ครบรอบ 90 วัน)';
            } else {
                tag.className = 'eligibility-tag wait-badge';
                tag.textContent = `⏳ อยู่ระหว่างเว้นระยะ (พร้อมบริจาคถัดไป: ${next.formatted_date} - เหลืออีก ${next.days_remaining} วัน)`;
            }

            previewCard.classList.remove('hidden');
        } else {
            previewCard.classList.add('hidden');
        }
    });


    recForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const donorId = parseInt(recSelect.value);
        if (!donorId) {
            showToast('⚠️ กรุณาเลือกผู้บริจาคก่อนบันทึกการบริจาค');
            return;
        }

        const volumeMl = parseInt(document.getElementById('rec-volume').value);
        const donationDate = document.getElementById('rec-date').value;
        const notes = document.getElementById('rec-notes').value.trim();

        try {
            const res = await fetch('/api/donations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donor_id: donorId,
                    volume_ml: volumeMl,
                    donation_date: donationDate,
                    notes: notes,
                    requester_role: currentRole
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const isApproved = (data.result?.status === 'approved');
                let toastMsg = isApproved 
                    ? `💉 บันทึกและอนุมัติการบริจาคสำเร็จ! สะสมรวมเป็น ${data.donor.donation_count} ครั้ง` 
                    : `💉 บันทึกรายการบริจาคสำเร็จ! รอเจ้าหน้าที่ Admin ตรวจสอบและยืนยันข้อมูล`;
                
                if (data.result?.newly_unlocked_milestone) {
                    toastMsg += ` 🏆 ปลดล็อกรางวัลใหม่: ${data.result.newly_unlocked_milestone.title}!`;
                }

                showToast(toastMsg);
                recForm.reset();
                previewCard.classList.add('hidden');
                loadDashboardStats();
                loadBloodInventory();
                loadPendingDonationRecords();
                populateDonorSelects();
                loadDonorsList();
            } else {
                showToast(`❌ ${data.message || 'บันทึกการบริจาคไม่สำเร็จ'}`);
            }
        } catch (err) {
            console.error('Record donation error:', err);
            showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    });
}

/* ==========================================================================
   7. Pending Registrations & Admin Approvals
   ========================================================================== */
async function loadPendingDonors() {
    const tableBody = document.getElementById('pending-donors-table-body');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/donors/pending');
        const data = await res.json();

        if (data && data.donors) {
            if (data.donors.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 15px;">ไม่มีรายการที่รอการตรวจสอบในขณะนี้</td></tr>`;
                return;
            }

            let html = '';
            data.donors.forEach((d, idx) => {
                html += `
                    <tr>
                        <td><strong>#${idx + 1}</strong></td>
                        <td><strong>${d.name}</strong><br><small style="color:#64748b;">ID System: #${d.donor_id}</small></td>
                        <td><code>${d.id_card}</code></td>
                        <td>${d.age} ปี / ${d.gender} / ${d.weight} kg</td>
                        <td><span class="blood-badge ${d.blood_type}">${d.blood_type}${d.rh_factor}</span></td>
                        <td>${d.phone}</td>
                        <td><span class="status-badge status-pending">⏳ รอตรวจสอบ</span></td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                <button class="btn btn-warning btn-sm" onclick="openEditDonorModal(${d.donor_id})" title="ตรวจสอบ/แก้ไขข้อมูล">✏️ ตรวจสอบ/แก้ไข</button>
                                <button class="btn btn-approve btn-sm" onclick="verifyDonor(${d.donor_id}, 'approve')" title="อนุมัติข้อมูล">✅ อนุมัติ</button>
                                <button class="btn btn-reject btn-sm" onclick="verifyDonor(${d.donor_id}, 'reject')" title="ปฏิเสธการลงทะเบียน">❌ ปฏิเสธ</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tableBody.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading pending donors:', err);
    }
}

async function verifyDonor(donorId, action) {
    if (currentRole !== 'admin') {
        showToast('⚠️ สิทธิ์ไม่เพียงพอ: เฉพาะเจ้าหน้าที่ Admin เท่านั้นที่สามารถอนุมัติได้');
        return;
    }

    try {
        const res = await fetch(`/api/donors/${donorId}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`✅ ${data.message}`);
            loadDashboardStats();
            loadBloodInventory();
            loadPendingDonors();
            populateDonorSelects();
            loadDonorsList();
        } else {
            showToast(`❌ ${data.message || 'ไม่สามารถทำรายการได้'}`);
        }
    } catch (err) {
        console.error('Error verifying donor:', err);
        showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
}

/* ==========================================================================
   8. Edit Donor Form & Admin Actions
   ========================================================================== */
function initEditDonorForm() {
    const editForm = document.getElementById('edit-donor-form');
    if (!editForm) return;

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const donorId = parseInt(document.getElementById('edit-donor-id').value);
        const idCard = document.getElementById('edit-id-card').value.trim();
        const name = document.getElementById('edit-name').value.trim();
        const age = parseInt(document.getElementById('edit-age').value);
        const gender = document.getElementById('edit-gender').value;
        const weight = parseFloat(document.getElementById('edit-weight').value);
        const bloodType = document.getElementById('edit-blood-type').value;
        const rhFactor = document.getElementById('edit-rh').value;
        const phone = document.getElementById('edit-phone').value.trim();
        const count = parseInt(document.getElementById('edit-count').value);
        const lastDate = document.getElementById('edit-last-date').value;
        const email = document.getElementById('edit-email').value.trim();
        const address = document.getElementById('edit-address').value.trim();

        const loggedInCard = localStorage.getItem('userName') || idCard;

        const payload = {
            requester_role: currentRole,
            verify_id_card: loggedInCard,
            id_card: idCard, name: name, age: age, gender: gender, weight: weight,
            blood_type: bloodType, rh_factor: rhFactor, phone: phone, donation_count: count,
            last_donation_date: lastDate || null, email: email, address: address
        };

        try {
            const res = await fetch(`/api/donors/${donorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`✅ แก้ไขข้อมูลส่วนตัวคุณ ${data.donor.name} สำเร็จ!`);
                closeEditDonorModal();
                closeDonorModal();
                closeDigitalCardModal();
                loadDashboardStats();
                loadBloodInventory();
                loadPendingDonors();
                populateDonorSelects();
                loadDonorsList();
            } else {
                showToast(`❌ ${data.message || 'ไม่สามารถแก้ไขข้อมูลได้'}`);
            }
        } catch (err) {
            console.error('Error updating donor:', err);
            showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    });
}

function openEditDonorModal(donorId) {
    const donor = allDonorsCache.find(d => d.donor_id === donorId);
    if (!donor) return;

    const loggedInCard = (localStorage.getItem('userIdCard') || '').trim();
    const loggedInName = (localStorage.getItem('userName') || '').trim();

    // Security check for non-admin user
    if (currentRole !== 'admin') {
        const isMatch = (loggedInCard && String(donor.id_card).trim() === loggedInCard) ||
                        (loggedInName && donor.name.trim() === loggedInName);
        if (!isMatch) {
            showToast('⚠️ ไม่อนุญาต: หมายเลขบัตรประชาชนไม่ตรงกัน คุณสามารถแก้ไขได้เฉพาะข้อมูลส่วนตัวของคุณเองเท่านั้น');
            return;
        }
    }

    const idCardInput = document.getElementById('edit-id-card');
    const countInput = document.getElementById('edit-count');
    const lastDateInput = document.getElementById('edit-last-date');
    const titleElem = document.getElementById('edit-donor-title');
    const subtitle = document.getElementById('edit-donor-subtitle');

    if (currentRole === 'admin') {
        if (titleElem) titleElem.textContent = '✏️ ตรวจสอบและแก้ไขข้อมูลผู้บริจาค (Admin Mode)';
        if (subtitle) subtitle.textContent = `รหัสผู้บริจาค: #${donor.donor_id}`;
        if (idCardInput) idCardInput.disabled = false;
        if (countInput) countInput.disabled = false;
        if (lastDateInput) lastDateInput.disabled = false;
    } else {
        if (titleElem) titleElem.textContent = '✏️ แก้ไขข้อมูลส่วนตัวผู้บริจาค';
        if (subtitle) subtitle.textContent = `รหัสผู้บริจาค: #${donor.donor_id}`;
        if (idCardInput) idCardInput.disabled = true; // Lock ID card for normal user
        if (countInput) countInput.disabled = true; // Lock donation count
        if (lastDateInput) lastDateInput.disabled = true; // Lock last donation date
    }


    document.getElementById('edit-donor-id').value = donor.donor_id;
    if (idCardInput) idCardInput.value = donor.id_card;
    document.getElementById('edit-name').value = donor.name;
    document.getElementById('edit-age').value = donor.age;
    document.getElementById('edit-gender').value = donor.gender;
    document.getElementById('edit-weight').value = donor.weight;
    document.getElementById('edit-blood-type').value = donor.blood_type;
    document.getElementById('edit-rh').value = donor.rh_factor;
    document.getElementById('edit-phone').value = donor.phone;
    if (countInput) countInput.value = donor.donation_count;
    if (lastDateInput) lastDateInput.value = donor.last_donation_date || '';
    document.getElementById('edit-email').value = donor.email || '';
    document.getElementById('edit-address').value = donor.address || '';

    document.getElementById('edit-donor-modal').classList.remove('hidden');
}

function closeEditDonorModal() {
    document.getElementById('edit-donor-modal').classList.add('hidden');
}

function openEditDonorModalFromDetail() {
    if (activeModalDonorId) openEditDonorModal(activeModalDonorId);
}

function openEditDonorModalFromDigitalCard() {
    if (activeModalDonorId) openEditDonorModal(activeModalDonorId);
}

function openMyProfileEditModal() {
    const savedCard = (localStorage.getItem('userIdCard') || '').trim();
    const savedName = (localStorage.getItem('userName') || '').trim();

    if (!savedCard && !savedName) {
        showToast('⚠️ กรุณาเข้าสู่ระบบในฐานะผู้บริจาคก่อนทำรายการแก้ไขข้อมูล');
        return;
    }

    let donor = null;
    if (savedCard) {
        donor = allDonorsCache.find(d => String(d.id_card).trim() === savedCard);
    }
    if (!donor && savedName) {
        donor = allDonorsCache.find(d => d.name.trim() === savedName);
    }

    if (donor) {
        openEditDonorModal(donor.donor_id);
    } else {
        showToast(`❌ ไม่พบข้อมูลผู้บริจาคในระบบ กรุณาลองเข้าสู่ระบบอีกครั้ง`);
    }
}



async function deleteDonor(donorId) {
    if (currentRole !== 'admin') {
        showToast('⚠️ สิทธิ์ไม่เพียงพอ: เฉพาะเจ้าหน้าที่ Admin เท่านั้นที่สามารถลบข้อมูลได้');
        return;
    }

    const donor = allDonorsCache.find(d => d.donor_id === donorId);
    if (!donor) return;

    if (!confirm(`⚠️ คุณแน่ใจหรือไม่ที่จะลบผู้บริจาคคุณ "${donor.name}" ออกจากระบบ?`)) return;

    try {
        const res = await fetch(`/api/donors/${donorId}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(`🗑️ ${data.message}`);
            closeDonorModal();
            loadDashboardStats();
            loadBloodInventory();
            loadPendingDonors();
            populateDonorSelects();
            loadDonorsList();
        } else {
            showToast(`❌ ${data.message || 'ไม่สามารถลบข้อมูลได้'}`);
        }
    } catch (err) {
        console.error('Error deleting donor:', err);
        showToast('❌ เกิดข้อผิดพลาดในการลบข้อมูล');
    }
}

function deleteDonorFromDetail() {
    if (activeModalDonorId) deleteDonor(activeModalDonorId);
}

function searchDonorByIdCardForMilestones() {
    const idCardInput = document.getElementById('lookup-idcard-input');
    const lookupSelect = document.getElementById('lookup-donor-select');
    if (!idCardInput || !lookupSelect) return;

    const idCard = idCardInput.value.trim();
    if (!idCard) return;

    const donor = allDonorsCache.find(d => String(d.id_card).trim() === idCard);
    if (donor) {
        lookupSelect.value = donor.donor_id;
        lookupSelect.dispatchEvent(new Event('change'));
    } else {
        lookupSelect.value = '';
        lookupSelect.dispatchEvent(new Event('change'));
        showToast(`❌ ไม่พบข้อมูลผู้บริจาคเลขบัตรประชาชน ${idCard}`);
    }
}

/* ==========================================================================
   9. Milestone Lookup
   ========================================================================== */
function initMilestoneLookup() {
    const lookupSelect = document.getElementById('lookup-donor-select');
    const lookupInput = document.getElementById('lookup-idcard-input');
    const resultDisplay = document.getElementById('lookup-result-display');
    const container = document.getElementById('lp-milestones-container');

    if (lookupInput) {
        lookupInput.addEventListener('input', () => {
            if (lookupInput.value.trim().length === 13) {
                searchDonorByIdCardForMilestones();
            }
        });
    }


    lookupSelect.addEventListener('change', () => {
        const donorId = parseInt(lookupSelect.value);
        const donor = allDonorsCache.find(d => d.donor_id === donorId);

        if (!donor) {
            resultDisplay.classList.add('hidden');
            return;
        }

        activeModalDonorId = donorId;
        resultDisplay.classList.remove('hidden');

        const next = donor.next_milestone;
        document.getElementById('lp-next-title').textContent = `${next.badge_icon} ${next.target_title}`;
        document.getElementById('lp-progress-text').textContent = `${next.progress_percent}%`;
        document.getElementById('lp-progress-fill').style.width = `${next.progress_percent}%`;
        document.getElementById('lp-remaining-text').textContent = next.remaining > 0 ? 
            `ขาดอีกเพียง ${next.remaining} ครั้ง จะได้รับเข็มและสวัสดิการเป้าหมายนี้` : 
            `คุณบรรลุเป้าหมายการบริจาคระดับนี้เรียบร้อยแล้ว!`;

        let html = '';
        donor.milestone_benefits.forEach(m => {
            const isUnlocked = m.unlocked;
            html += `
                <div class="rule-card ${isUnlocked ? 'highlight-gold' : ''}">
                    <div class="rule-badge ${isUnlocked ? 'gold' : ''}">${isUnlocked ? '✓ ปลดล็อกแล้ว' : 'ยังไม่ถึงเกณฑ์'}</div>
                    <div class="rule-icon">${m.badge_icon}</div>
                    <h4>${m.title}</h4>
                    <ul>
                        ${m.benefits.map(b => `<li>${b}</li>`).join('')}
                    </ul>
                </div>
            `;
        });

        container.innerHTML = html;
    });
}

function triggerDigitalCardFromLookup() {
    if (activeModalDonorId) openDigitalCardModal(activeModalDonorId);
}

function triggerCertificateFromLookup() {
    if (activeModalDonorId) openCertificateModal(activeModalDonorId);
}

/* ==========================================================================
   10. Donors Directory - Grouped by Blood Type & Sequentially Numbered (#1, #2...)
   ========================================================================== */
function initDonorsDirectory() {
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-blood-type');

    let debounceTimer;
    const triggerSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadDonorsList(searchInput.value, filterSelect.value);
        }, 300);
    };

    searchInput.addEventListener('input', triggerSearch);
    filterSelect.addEventListener('change', () => loadDonorsList(searchInput.value, filterSelect.value));
}

async function loadDonorsList(searchQuery = '', bloodTypeFilter = '') {
    const tableBody = document.getElementById('donors-table-body');
    if (!tableBody) return;

    try {
        const url = `/api/donors?q=${encodeURIComponent(searchQuery)}&blood_type=${encodeURIComponent(bloodTypeFilter)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.donors) {
            data.donors.sort((a, b) => a.donor_id - b.donor_id);
            allDonorsCache = data.donors;

            if (data.donors.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 30px;">ไม่พบข้อมูลผู้บริจาคในระบบ</td></tr>`;
                return;
            }

            const bloodOrder = ['O', 'A', 'B', 'AB'];
            const grouped = { 'O': [], 'A': [], 'B': [], 'AB': [] };

            data.donors.forEach(d => {
                const bType = d.blood_type;
                if (grouped[bType]) {
                    grouped[bType].push(d);
                } else {
                    grouped[bType] = [d];
                }
            });

            for (const bType of bloodOrder) {
                grouped[bType].sort((a, b) => a.donor_id - b.donor_id);
            }

            let fullHtml = '';
            const displayGroups = bloodTypeFilter ? [bloodTypeFilter] : bloodOrder;

            displayGroups.forEach(bGroup => {
                const donorsInGroup = grouped[bGroup] || [];
                if (donorsInGroup.length === 0 && bloodTypeFilter) return;

                fullHtml += `
                    <tr class="blood-group-header-row">
                        <td colspan="10">
                            <div class="blood-group-header">
                                <span class="blood-badge ${bGroup}">หมู่ ${bGroup}</span>
                                <strong>กลุ่มผู้บริจาคหมู่เลือด ${bGroup}</strong>
                                <span class="group-count-tag">(${donorsInGroup.length} คน)</span>
                            </div>
                        </td>
                    </tr>
                `;

                if (donorsInGroup.length === 0) {
                    fullHtml += `<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 12px;">ยังไม่มีผู้บริจาคในกลุ่มหมู่เลือด ${bGroup}</td></tr>`;
                } else {
                    donorsInGroup.forEach((d, idx) => {
                        const seqNum = idx + 1; // Sequential 1, 2, 3... per group section

                        let milestoneBadge = '<span class="badge-benefit">ผู้บริจาคทั่วไป</span>';
                        if (d.donation_count >= 24) {
                            milestoneBadge = '<span class="badge-benefit gold">🏆 สิทธิยกเว้นค่าห้อง/ค่ารักษา (24+)</span>';
                        } else if (d.donation_count >= 7) {
                            milestoneBadge = '<span class="badge-benefit gold">🎗️ ตรวจสุขภาพฟรี (7+)</span>';
                        } else if (d.donation_count >= 1) {
                            milestoneBadge = '<span class="badge-benefit">🏅 ผู้บริจาคใหม่ (1+)</span>';
                        }

                        const next = d.next_eligible;
                        const readyBadge = next.is_ready_today ? 
                            '<span class="ready-badge">✅ พร้อมบริจาค</span>' : 
                            `<span class="wait-badge">⏳ ${next.formatted_date} (${next.days_remaining} วัน)</span>`;

                        const statusTag = d.status === 'pending' ?
                            '<span class="status-badge status-pending">⏳ รอตรวจสอบ</span>' :
                            (d.status === 'rejected' ? '<span class="status-badge status-rejected">❌ ปฏิเสธ</span>' : '<span class="status-badge status-approved">✅ อนุมัติแล้ว</span>');

                        const adminActions = (currentRole === 'admin') ? 
                            `<button class="btn btn-warning btn-sm" onclick="openEditDonorModal(${d.donor_id})" title="แก้ไขข้อมูลผู้บริจาค">✏️ แก้ไข</button>
                             ${d.status === 'pending' ? `<button class="btn btn-approve btn-sm" onclick="verifyDonor(${d.donor_id}, 'approve')" title="อนุมัติการลงทะเบียน">✅ อนุมัติ</button>` : ''}
                             <button class="btn btn-danger btn-sm" onclick="deleteDonor(${d.donor_id})" title="ลบข้อมูลผู้บริจาค">🗑️ ลบ</button>` : '';

                        fullHtml += `
                            <tr>
                                <td><strong>#${seqNum}</strong></td>
                                <td><strong>${d.name}</strong><br><small style="color:#64748b;">${d.phone} (ID: #${d.donor_id})</small></td>
                                <td>${d.age} ปี / ${d.gender}</td>
                                <td>${d.weight} kg</td>
                                <td><span class="blood-badge ${d.blood_type}">${d.blood_type}${d.rh_factor}</span></td>
                                <td>${statusTag}</td>
                                <td><strong class="text-crimson" style="font-size:1.05rem;">${d.donation_count}</strong> ครั้ง</td>
                                <td>${readyBadge}</td>
                                <td>${milestoneBadge}</td>
                                <td>
                                    <div style="display:flex; gap:6px; align-items:center;">
                                        <button class="btn btn-secondary btn-sm" onclick="openDonorModal(${d.donor_id})">ดูประวัติ & สิทธิ</button>
                                        ${adminActions}
                                    </div>
                                </td>
                            </tr>
                        `;
                    });
                }
            });

            tableBody.innerHTML = fullHtml;
        }
    } catch (err) {
        console.error('Error loading donors table:', err);
    }
}

/* ==========================================================================
   11. Modals: Detail, Digital Card, Certificate
   ========================================================================== */
async function openDonorModal(donorId) {
    activeModalDonorId = donorId;
    try {
        const res = await fetch(`/api/donors/${donorId}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const d = data.donor;

            document.getElementById('modal-name').textContent = d.name;
            document.getElementById('modal-id-card').textContent = `เลขบัตร: ${d.id_card}`;
            document.getElementById('modal-age').textContent = d.age;
            document.getElementById('modal-gender').textContent = d.gender;
            document.getElementById('modal-weight').textContent = d.weight;
            document.getElementById('modal-blood').textContent = `${d.blood_type}${d.rh_factor}`;
            document.getElementById('modal-phone').textContent = d.phone;
            document.getElementById('modal-count').textContent = d.donation_count;

            const editBtn = document.getElementById('detail-edit-btn');
            const delBtn = document.getElementById('detail-delete-btn');
            if (currentRole === 'admin') {
                if (editBtn) editBtn.classList.remove('hidden');
                if (delBtn) delBtn.classList.remove('hidden');
            } else {
                if (editBtn) editBtn.classList.add('hidden');
                if (delBtn) delBtn.classList.add('hidden');
            }

            const milestonesContainer = document.getElementById('modal-milestones-list');
            let mHtml = '';
            d.milestone_benefits.forEach(m => {
                if (m.unlocked) {
                    mHtml += `<div class="badge-benefit gold" style="display:inline-block; margin: 4px; padding: 6px 12px; font-size: 0.85rem;">${m.badge_icon} ${m.title}</div>`;
                }
            });
            milestonesContainer.innerHTML = mHtml || '<span style="color:#94a3b8;">ยังไม่บรรลุเกณฑ์สวัสดิการสะสม</span>';

            const historyBody = document.getElementById('modal-history-body');
            if (d.history && d.history.length > 0) {
                let hRows = '';
                d.history.forEach(h => {
                    hRows += `
                        <tr>
                            <td>${h.donation_date}</td>
                            <td>${h.volume_ml} ml</td>
                            <td>${h.staff_notes || '-'}</td>
                        </tr>
                    `;
                });
                historyBody.innerHTML = hRows;
            } else {
                historyBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">ยังไม่มีประวัติบันทึกการบริจาค</td></tr>`;
            }

            document.getElementById('donor-modal').classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error opening donor modal:', err);
    }
}

function closeDonorModal() {
    document.getElementById('donor-modal').classList.add('hidden');
}

function openDigitalCardModalFromDetail() {
    if (activeModalDonorId) openDigitalCardModal(activeModalDonorId);
}

function openCertificateModalFromDetail() {
    if (activeModalDonorId) openCertificateModal(activeModalDonorId);
}

async function openDigitalCardModal(donorId) {
    try {
        const res = await fetch(`/api/donors/${donorId}`);
        const data = await res.json();
        if (res.ok && data.success) {
            const d = data.donor;
            document.getElementById('card-donor-name').textContent = d.name;
            document.getElementById('card-donor-id').textContent = `ID: #${d.donor_id.toString().padStart(5, '0')} | บัตรประชาชน: ${d.id_card}`;
            document.getElementById('card-blood-badge').textContent = `หมู่ ${d.blood_type}${d.rh_factor}`;
            document.getElementById('card-blood-badge').className = `blood-badge ${d.blood_type}`;
            document.getElementById('card-count-badge').textContent = `บริจาคสะสม ${d.donation_count} ครั้ง`;
            document.getElementById('card-last-date').textContent = d.last_donation_date || 'ยังไม่เคย';
            document.getElementById('card-next-date').textContent = d.next_eligible.formatted_date;

            document.getElementById('digital-card-modal').classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error loading digital card:', err);
    }
}

function closeDigitalCardModal() {
    document.getElementById('digital-card-modal').classList.add('hidden');
}

async function openCertificateModal(donorId) {
    try {
        const res = await fetch(`/api/donors/${donorId}/certificate`);
        const data = await res.json();

        if (res.ok && data.success) {
            const cert = data.certificate;
            document.getElementById('cert-donor-name').textContent = cert.donor_name;
            document.getElementById('cert-milestone-title').textContent = `${cert.badge_icon} ${cert.milestone_title}`;
            document.getElementById('cert-honor-level').textContent = cert.honor_level;
            document.getElementById('cert-issue-date').textContent = cert.issue_date;
            document.getElementById('cert-no').textContent = cert.certificate_no;

            document.getElementById('certificate-modal').classList.remove('hidden');
        } else {
            showToast(`⚠️ ${data.message || 'ไม่สามารถออกใบประกาศได้'}`);
        }
    } catch (err) {
        console.error('Error loading certificate:', err);
        showToast('⚠️ ไม่สามารถออกใบประกาศเกียรติคุณได้');
    }
}

function closeCertificateModal() {
    document.getElementById('certificate-modal').classList.add('hidden');
}

/* ==========================================================================
   12. Toast Notification System
   ========================================================================== */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

/* ==========================================================================
   13. Chart.js Visualizations Controller
   ========================================================================== */
let inventoryDoughnutChartInstance = null;
let milestoneBarChartInstance = null;

function renderDashboardCharts(statsData) {
    if (typeof Chart === 'undefined') return;

    // 1. Doughnut Chart for Blood Inventory
    const ctxDoughnut = document.getElementById('inventoryDoughnutChart');
    if (ctxDoughnut && statsData && statsData.inventory) {
        const labels = ['หมู่ O', 'หมู่ A', 'หมู่ B', 'หมู่ AB'];
        const dataValues = [
            statsData.inventory.O?.bags || 0,
            statsData.inventory.A?.bags || 0,
            statsData.inventory.B?.bags || 0,
            statsData.inventory.AB?.bags || 0
        ];

        if (inventoryDoughnutChartInstance) {
            inventoryDoughnutChartInstance.destroy();
        }

        inventoryDoughnutChartInstance = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // 2. Bar Chart for Milestone Achievements
    const ctxBar = document.getElementById('milestoneBarChart');
    if (ctxBar && statsData && statsData.milestones_achieved) {
        const milestoneLabels = ['1 - 6 ครั้ง (🏅)', '7 - 23 ครั้ง (🎗️)', '24+ ครั้งขึ้นไป (🥈)'];
        const milestoneValues = [
            statsData.milestones_achieved.band_1_6 ?? (statsData.milestones_achieved.count_1 || 0),
            statsData.milestones_achieved.band_7_23 ?? (statsData.milestones_achieved.count_7 || 0),
            statsData.milestones_achieved.band_24_plus ?? (statsData.milestones_achieved.count_24 || 0)
        ];


        if (milestoneBarChartInstance) {
            milestoneBarChartInstance.destroy();
        }

        milestoneBarChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: milestoneLabels,
                datasets: [{
                    label: 'จำนวนผู้บริจาค (คน)',
                    data: milestoneValues,
                    backgroundColor: ['#10b981', '#6366f1', '#f59e0b'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/* ==========================================================================
   14. Appointment Booking Controller
   ========================================================================== */
function searchDonorByIdCardForAppointment() {
    const idCardInput = document.getElementById('app-idcard-input');
    const hiddenDonorId = document.getElementById('app-donor-id');
    const previewBox = document.getElementById('app-donor-preview-box');
    const infoText = document.getElementById('app-donor-info-text');

    if (!idCardInput || !hiddenDonorId || !previewBox || !infoText) return null;

    const idCard = idCardInput.value.trim();
    if (!idCard) {
        previewBox.classList.add('hidden');
        hiddenDonorId.value = '';
        return null;
    }

    let donor = allDonorsCache.find(d => String(d.id_card).trim() === idCard);

    if (donor) {
        hiddenDonorId.value = donor.donor_id;
        previewBox.className = 'result-box pass';
        previewBox.classList.remove('hidden');
        infoText.innerHTML = `<strong>✅ พบข้อมูลผู้บริจาค:</strong> คุณ <strong>${donor.name}</strong> | หมู่ ${donor.blood_type}${donor.rh_factor || '+'} | อายุ ${donor.age} ปี | บริจาคสะสม ${donor.donation_count} ครั้ง`;
        return donor;
    } else {
        hiddenDonorId.value = '';
        previewBox.className = 'result-box fail';
        previewBox.classList.remove('hidden');
        infoText.innerHTML = `<strong>❌ ไม่พบข้อมูลผู้บริจาค:</strong> ไม่พบรหัสบัตรประชาชน <code>${idCard}</code> ในระบบ (กรุณาลงทะเบียนผู้บริจาคใหม่ก่อนจองคิว)`;
        return null;
    }
}

function initAppointmentBooking() {
    const appForm = document.getElementById('appointment-booking-form');
    const appDate = document.getElementById('app-date');
    const idCardInput = document.getElementById('app-idcard-input');

    if (appDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        appDate.value = tomorrow.toISOString().split('T')[0];
        appDate.min = new Date().toISOString().split('T')[0];
    }

    if (idCardInput) {
        idCardInput.addEventListener('input', () => {
            const val = idCardInput.value.trim();
            if (val.length === 13) {
                searchDonorByIdCardForAppointment();
            } else if (val.length === 0) {
                const previewBox = document.getElementById('app-donor-preview-box');
                const hiddenDonorId = document.getElementById('app-donor-id');
                if (previewBox) previewBox.classList.add('hidden');
                if (hiddenDonorId) hiddenDonorId.value = '';
            }
        });
    }

    if (appForm) {
        appForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let donorId = parseInt(document.getElementById('app-donor-id').value);
            const idCard = document.getElementById('app-idcard-input').value.trim();

            if (!donorId && idCard) {
                const found = searchDonorByIdCardForAppointment();
                if (found) donorId = found.donor_id;
            }

            if (!donorId) {
                showToast('⚠️ กรุณาระบุเลขบัตรประชาชน 13 หลักที่ลงทะเบียนในระบบเรียบร้อยแล้ว');
                return;
            }

            const date = document.getElementById('app-date').value;
            const slot = document.getElementById('app-time-slot').value;
            const location = document.getElementById('app-location').value;
            const donationType = document.getElementById('app-donation-type')?.value || 'บริจาคโลหิตรวม';
            const purpose = document.getElementById('app-purpose')?.value || 'บริจาคโลหิตทั่วไปเพื่อคลังสำรอง';
            const notes = document.getElementById('app-notes').value.trim();

            try {
                const res = await fetch('/api/appointments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        donor_id: donorId,
                        appointment_date: date,
                        time_slot: slot,
                        location: location,
                        donation_type: donationType,
                        purpose: purpose,
                        notes: notes
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(`📅 ${data.message}`);
                    appForm.reset();
                    document.getElementById('app-donor-preview-box')?.classList.add('hidden');
                    document.getElementById('app-donor-id').value = '';
                    if (appDate) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        appDate.value = tomorrow.toISOString().split('T')[0];
                    }
                    loadAppointmentsList();
                } else {
                    showToast(`❌ ${data.message || 'เกิดข้อผิดพลาดในการจองคิวนัดหมาย'}`);
                }
            } catch (err) {
                console.error('Appointment booking error:', err);
                showToast('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
            }
        });
    }

    loadAppointmentsList();
}


async function loadAppointmentsList() {
    const container = document.getElementById('appointments-container');
    if (!container) return;

    try {
        const res = await fetch('/api/appointments');
        const data = await res.json();

        if (data && data.appointments) {
            if (data.appointments.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">ยังไม่มีรายการนัดหมายในขณะนี้</p>';
                return;
            }

            let html = '';
            data.appointments.forEach(app => {
                const statusBadgeClass = app.status === 'completed' ? 'ready-badge' : (app.status === 'cancelled' ? 'wait-badge' : 'status-pending');
                const statusLabel = app.status === 'completed' ? '✅ บริจาคเรียบร้อย' : (app.status === 'cancelled' ? '❌ ยกเลิกนัดหมาย' : '📅 รอนัดหมาย');

                html += `
                    <div class="appointment-card" style="background: rgba(255,255,255,0.7); padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h4 style="margin: 0 0 4px 0; color: #1e293b;">คุณ${app.donor_name || 'ผู้บริจาค'} <span class="blood-badge ${app.blood_type || 'O'}">หมู่ ${app.blood_type || 'O'}</span></h4>
                            <p style="margin: 3px 0; font-size: 0.88rem; color: #475569;">🗓️ <strong>${app.appointment_date}</strong> (${app.time_slot})</p>
                            <p style="margin: 3px 0; font-size: 0.85rem; color: #0284c7;">💉 <strong>ประเภท:</strong> ${app.donation_type || 'บริจาคโลหิตรวม'} | ❤️ <strong>วัตถุประสงค์:</strong> ${app.purpose || 'บริจาคทั่วไป'}</p>
                            <p style="margin: 3px 0; font-size: 0.85rem; color: #64748b;">📍 ${app.location}</p>
                            ${app.notes ? `<p style="margin: 3px 0; font-size: 0.8rem; color: #94a3b8;">💬 ${app.notes}</p>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <span class="eligibility-tag ${statusBadgeClass}" style="display: inline-block; margin-bottom: 8px;">${statusLabel}</span>
                            ${currentRole === 'admin' && app.status === 'scheduled' ? `
                                <div style="display:flex; gap:4px; justify-content:flex-end;">
                                    <button class="btn btn-approve btn-sm" onclick="updateAppointmentStatus(${app.appointment_id}, 'completed')">✅ สำเร็จ</button>
                                    <button class="btn btn-reject btn-sm" onclick="updateAppointmentStatus(${app.appointment_id}, 'cancelled')">❌ ยกเลิก</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}


async function updateAppointmentStatus(appId, newStatus) {
    try {
        const res = await fetch(`/api/appointments/${appId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`✅ ${data.message}`);
            loadAppointmentsList();
        } else {
            showToast(`❌ ${data.message || 'ไม่สามารถอัปเดตสถานะได้'}`);
        }
    } catch (err) {
        console.error('Update appointment status error:', err);
    }
}

/* ==========================================================================
   15. E-Certificate PDF Generator Controller
   ========================================================================== */
function downloadCertificatePDF() {
    const certElement = document.querySelector('.honor-certificate');
    if (!certElement) {
        showToast('⚠️ ไม่พบแบบฟอร์มใบประกาศเกียรติคุณ');
        return;
    }

    if (typeof html2pdf === 'undefined') {
        showToast('⚠️ กำลังโหลดไลบรารี PDF กรุณาลองใหม่อีกครั้ง');
        return;
    }

    const donorName = document.getElementById('cert-donor-name')?.textContent || 'donor';
    const opt = {
        margin:       10,
        filename:     `Certificate_BloodDonation_${donorName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    showToast('📥 กำลังสร้างไฟล์ PDF ใบประกาศเกียรติคุณ...');

    html2pdf().set(opt).from(certElement).save().then(() => {
        showToast('🎉 ดาวน์โหลดใบประกาศเกียรติคุณ PDF สำเร็จ!');
    }).catch(err => {
        console.error('Error generating PDF:', err);
        showToast('❌ ไม่สามารถสร้างไฟล์ PDF ได้');
    });
}


/* ==========================================================================
   16. 90-Day Due Donors Notifications, Station Locator & Audit Logs
   ========================================================================== */
async function loadDueNotifications() {
    const listContainer = document.getElementById('due-donors-list');
    const badgeCount = document.getElementById('due-count-badge');
    if (!listContainer) return;

    try {
        const res = await fetch('/api/donors/due-notifications');
        const data = await res.json();

        if (data && data.success) {
            if (badgeCount) badgeCount.textContent = data.count || 0;

            if (!data.ready_donors || data.ready_donors.length === 0) {
                listContainer.innerHTML = '<p style="color:#64748b; padding:10px;">ขณะนี้ยังไม่มีผู้บริจาคที่ครบรอบ 90 วันในสัปดาห์นี้</p>';
                return;
            }

            let html = '';
            data.ready_donors.forEach(d => {
                html += `
                    <div style="background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.06); padding:12px 14px; border-radius:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <strong style="color:#1e293b;">คุณ${d.name}</strong>
                            <span class="blood-badge ${d.blood_type.replace('+', '')}" style="font-size:0.75rem;">${d.blood_type}</span>
                        </div>
                        <p style="margin:2px 0; font-size:0.83rem; color:#475569;">📞 โทร: ${d.phone} | บัตร: <code>${d.id_card}</code></p>
                        <p style="margin:2px 0; font-size:0.8rem; color:#16a34a; font-weight:600;">${d.status_message}</p>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading due notifications:', err);
    }
}

async function loadAuditLogs() {
    const tableBody = document.getElementById('audit-logs-table-body');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/admin/audit-logs');
        const data = await res.json();

        if (data && data.logs) {
            if (data.logs.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">ยังไม่มีประวัติการทำรายการในขณะนี้</td></tr>';
                return;
            }

            let html = '';
            data.logs.forEach(log => {
                html += `
                    <tr>
                        <td><strong>#${log.log_id}</strong></td>
                        <td><small style="color:#64748b;">${log.timestamp}</small></td>
                        <td><span class="status-badge status-approved">🔑 ${log.admin_username}</span></td>
                        <td><strong>${log.action_type}</strong></td>
                        <td>${log.details || '-'}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading audit logs:', err);
    }
}

const stationsData = [
    { id: 1, name: 'ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย (ถนนอังรีดูนังต์)', region: 'กรุงเทพและปริมณฑล', address: 'ถนนอังรีดูนังต์ แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ', phone: '02-256-4300', hours: '07:30 - 19:30 น.', map_url: 'https://maps.google.com/?q=Thai+Red+Cross+Society' },
    { id: 2, name: 'สถานีกาชาด เดอะมอลล์ บางกะปิ (ชั้น 3)', region: 'กรุงเทพและปริมณฑล', address: 'เดอะมอลล์ บางกะปิ ชั้น 3 ถนนลาดพร้าว กรุงเทพฯ', phone: '02-173-1000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=The+Mall+Bangkapi' },
    { id: 3, name: 'สถานีกาชาด เดอะมอลล์ งามวงศ์วาน (ชั้น 5)', region: 'กรุงเทพและปริมณฑล', address: 'เดอะมอลล์ งามวงศ์วาน ชั้น 5 อ.เมือง นนทบุรี', phone: '02-555-1000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=The+Mall+Ngamwongwan' },
    { id: 4, name: 'สถานีกาชาด เดอะมอลล์ บางแค (ชั้น P)', region: 'กรุงเทพและปริมณฑล', address: 'เดอะมอลล์ บางแค ชั้น P ถนนเพชรเกษม กรุงเทพฯ', phone: '02-487-1000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=The+Mall+Bangkae' },
    { id: 5, name: 'สถานีกาชาด เดอะมอลล์ ท่าพระ (ชั้น 1)', region: 'กรุงเทพและปริมณฑล', address: 'เดอะมอลล์ ท่าพระ ชั้น 1 ถนนรัชดาภิเษก กรุงเทพฯ', phone: '02-469-1000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=The+Mall+Thapra' },
    { id: 6, name: 'สถานีกาชาด ดิ เอ็มโพเรียม (ชั้น M)', region: 'กรุงเทพและปริมณฑล', address: 'ดิ เอ็มโพเรียม ชั้น M ถนนสุขุมวิท กรุงเทพฯ', phone: '02-269-1000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=Emporium+Bangkok' },
    { id: 7, name: 'สถานีกาชาด ฟิวเจอร์พาร์ค รังสิต (ชั้น 3)', region: 'กรุงเทพและปริมณฑล', address: 'ฟิวเจอร์พาร์ค รังสิต ชั้น 3 อ.ธัญบุรี ปทุมธานี', phone: '02-958-0000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=Future+Park+Rangsit' },
    { id: 8, name: 'สถานีกาชาด แฟชั่นไอส์แลนด์ (ชั้น 3)', region: 'กรุงเทพและปริมณฑล', address: 'แฟชั่นไอส์แลนด์ ชั้น 3 ถนนรามอินทรา กรุงเทพฯ', phone: '02-947-5000', hours: '12:00 - 18:00 น.', map_url: 'https://maps.google.com/?q=Fashion+Island+Bangkok' },
    { id: 9, name: 'ธนาคารเลือด โรงพยาบาลจุฬาลงกรณ์', region: 'กรุงเทพและปริมณฑล', address: 'ตึกภูมิสิริมังคลานุสรณ์ ชั้น 3 รพ.จุฬาลงกรณ์', phone: '02-256-4000', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=King+Chulalongkorn+Memorial+Hospital' },
    { id: 10, name: 'ธนาคารเลือด โรงพยาบาลศิริราช', region: 'กรุงเทพและปริมณฑล', address: 'ตึก 72 ปี ชั้น 3 รพ.ศิริราช แบงกอกน้อย', phone: '02-419-7492', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Siriraj+Hospital' },
    { id: 11, name: 'ธนาคารเลือด โรงพยาบาลรามาธิบดี', region: 'กรุงเทพและปริมณฑล', address: 'อาคารหลัก ชั้น 3 ถนนพระราม 6 กรุงเทพฯ', phone: '02-201-1200', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Ramathibodi+Hospital' },
    { id: 12, name: 'ธนาคารเลือด โรงพยาบาลพระมงกุฎเกล้า', region: 'กรุงเทพและปริมณฑล', address: 'อาคารเฉลิมพระเกียรติ ชั้น 3 ถนนราชวิถี กรุงเทพฯ', phone: '02-763-9300', hours: '08:30 - 16:00 น.', map_url: 'https://maps.google.com/?q=Phramongkutklao+Hospital' },
    { id: 13, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 2 จังหวัดชลบุรี', region: 'ภาคกลาง', address: 'อ.เมือง ชลบุรี (ตรงข้าม รพ.ชลบุรี)', phone: '038-278-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Chonburi+Red+Cross' },
    { id: 14, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 3 จังหวัดนครสวรรค์', region: 'ภาคกลาง', address: 'อ.เมือง นครสวรรค์', phone: '056-221-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Nakhon+Sawan+Red+Cross' },
    { id: 15, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 5 จังหวัดนครราชสีมา', region: 'ภาคอีสาน', address: 'อ.เมือง นครราชสีมา', phone: '044-242-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Nakhon+Ratchasima+Red+Cross' },
    { id: 16, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 6 จังหวัดขอนแก่น', region: 'ภาคอีสาน', address: 'อ.เมือง ขอนแก่น', phone: '043-241-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Khon+Kaen+Red+Cross' },
    { id: 17, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 10 จังหวัดเชียงใหม่', region: 'ภาคเหนือ', address: 'อ.เมือง เชียงใหม่', phone: '053-241-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Chiang+Mai+Red+Cross' },
    { id: 18, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 11 จังหวัดภูเก็ต', region: 'ภาคใต้', address: 'อ.เมือง ภูเก็ต', phone: '076-211-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Phuket+Red+Cross' },
    { id: 19, name: 'ภาคบริการโลหิตแห่งชาติ ที่ 12 จังหวัดสงขลา (หาดใหญ่)', region: 'ภาคใต้', address: 'อ.หาดใหญ่ สงขลา', phone: '074-241-123', hours: '08:30 - 16:30 น.', map_url: 'https://maps.google.com/?q=Hat+Yai+Red+Cross' },
    { id: 20, name: 'หน่วยรับบริจาคโลหิตเคลื่อนที่ (Mobile Unit)', region: 'กรุงเทพและปริมณฑล', address: 'ออกหน่วยตามสถาบันการศึกษาและบริษัทเอกชนประจำวัน', phone: '02-256-4300', hours: '09:00 - 15:00 น.', map_url: 'https://maps.google.com/?q=Thai+Red+Cross+Society' }
];

function renderStationsList() {
    const grid = document.getElementById('stations-grid');
    const searchVal = (document.getElementById('station-search-input')?.value || '').toLowerCase().trim();
    const regionVal = document.getElementById('station-region-filter')?.value || '';

    if (!grid) return;

    const filtered = stationsData.filter(s => {
        const matchSearch = !searchVal || s.name.toLowerCase().includes(searchVal) || s.address.toLowerCase().includes(searchVal);
        const matchRegion = !regionVal || s.region === regionVal;
        return matchSearch && matchRegion;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:30px; color:#94a3b8;">ไม่พบสถานีรับบริจาคโลหิตที่ค้นหา</p>';
        return;
    }

    let html = '';
    filtered.forEach(s => {
        html += `
            <div class="appointment-card" style="background:rgba(255,255,255,0.85); padding:16px; border-radius:12px; border:1px solid rgba(0,0,0,0.06);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <h4 style="margin:0; color:#1e293b; font-size:0.95rem;">📍 ${s.name}</h4>
                    <span class="eligibility-tag ready-badge" style="font-size:0.75rem;">🟢 เปิดบริการ</span>
                </div>
                <p style="margin:4px 0; font-size:0.83rem; color:#475569;">🏢 <strong>ภูมิภาค:</strong> ${s.region}</p>
                <p style="margin:4px 0; font-size:0.83rem; color:#64748b;">📍 ${s.address}</p>
                <p style="margin:4px 0; font-size:0.83rem; color:#0284c7;">🕒 <strong>เวลาทำการ:</strong> ${s.hours}</p>
                <p style="margin:4px 0; font-size:0.83rem; color:#334155;">📞 <strong>เบอร์ติดต่อ:</strong> ${s.phone}</p>
                <div style="margin-top:12px; text-align:right;">
                    <a href="${s.map_url}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">🗺️ เปิดพิกัด Google Maps</a>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}


