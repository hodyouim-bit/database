/**
 * Blood Donation System - Frontend JavaScript Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    initQuickEligibilityChecker();
    initRegistrationForm();
    initRecordDonationForm();
    initMilestoneLookup();
    initDonorsDirectory();
    
    // Initial data load
    loadDashboardStats();
    loadDonorsList();
    populateDonorSelects();

    // Set today's date in record donation form
    const recDateInput = document.getElementById('rec-date');
    if (recDateInput) {
        recDateInput.value = new Date().toISOString().split('T')[0];
    }
});

/* ==========================================================================
   1. Navigation & Tab Switching
   ========================================================================== */
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
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update active tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Refresh tab-specific data
    if (tabId === 'dashboard') loadDashboardStats();
    if (tabId === 'donors-list') loadDonorsList();
    if (tabId === 'record' || tabId === 'milestones') populateDonorSelects();
}

/* ==========================================================================
   2. Dashboard Stats Loader
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
        }
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

/* ==========================================================================
   3. Live Quick Eligibility Checker
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

    // Run initial check
    updateCheck();
}

/* ==========================================================================
   4. Donor Registration Form
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
            id_card: idCard,
            name: name,
            age: age,
            gender: gender,
            weight: weight,
            blood_type: bloodType,
            rh_factor: rhFactor,
            phone: phone,
            email: email,
            address: address,
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
                showToast(`🎉 ลงทะเบียนสำเร็จ! ยินดีต้อนรับคุณ ${data.donor.name}`);
                regForm.reset();
                loadDashboardStats();
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

/* ==========================================================================
   5. Populate Donor Select Dropdowns
   ========================================================================== */
let allDonorsCache = [];

async function populateDonorSelects() {
    try {
        const response = await fetch('/api/donors');
        const data = await response.json();
        if (data && data.donors) {
            allDonorsCache = data.donors;

            const recSelect = document.getElementById('rec-donor-select');
            const lookupSelect = document.getElementById('lookup-donor-select');

            let optionsHtml = '<option value="">-- กรุณาเลือกผู้บริจาค --</option>';
            data.donors.forEach(d => {
                optionsHtml += `<option value="${d.donor_id}">${d.name} (หมู่ ${d.blood_type}${d.rh_factor}) - บริจาคสะสม ${d.donation_count} ครั้ง</option>`;
            });

            if (recSelect) recSelect.innerHTML = optionsHtml;
            if (lookupSelect) lookupSelect.innerHTML = optionsHtml;
        }
    } catch (err) {
        console.error('Error fetching donors list for select:', err);
    }
}

/* ==========================================================================
   6. Record Donation Form
   ========================================================================== */
function initRecordDonationForm() {
    const recSelect = document.getElementById('rec-donor-select');
    const previewCard = document.getElementById('donor-preview-card');
    const recForm = document.getElementById('record-donation-form');

    recSelect.addEventListener('change', () => {
        const donorId = parseInt(recSelect.value);
        const donor = allDonorsCache.find(d => d.donor_id === donorId);

        if (donor) {
            document.getElementById('prev-name').textContent = donor.name;
            document.getElementById('prev-blood').textContent = `${donor.blood_type}${donor.rh_factor}`;
            document.getElementById('prev-count').textContent = donor.donation_count;
            document.getElementById('prev-weight').textContent = donor.weight;
            document.getElementById('prev-date').textContent = donor.last_donation_date || 'ยังไม่เคยบริจาค';
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
                    notes: notes
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const updatedDonor = data.donor;
                let toastMsg = `💉 บันทึกการบริจาคสำเร็จ! สะสมรวมเป็น ${updatedDonor.donation_count} ครั้ง`;
                
                if (data.result?.newly_unlocked_milestone) {
                    toastMsg += ` 🏆 ปลดล็อกรางวัลใหม่: ${data.result.newly_unlocked_milestone.title}!`;
                }

                showToast(toastMsg);
                recForm.reset();
                previewCard.classList.add('hidden');
                loadDashboardStats();
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
   7. Milestone Lookup Tool
   ========================================================================== */
function initMilestoneLookup() {
    const lookupSelect = document.getElementById('lookup-donor-select');
    const resultDisplay = document.getElementById('lookup-result-display');
    const container = document.getElementById('lp-milestones-container');

    lookupSelect.addEventListener('change', () => {
        const donorId = parseInt(lookupSelect.value);
        const donor = allDonorsCache.find(d => d.donor_id === donorId);

        if (!donor) {
            resultDisplay.classList.add('hidden');
            return;
        }

        resultDisplay.classList.remove('hidden');

        // Progress bar
        const next = donor.next_milestone;
        document.getElementById('lp-next-title').textContent = `${next.badge_icon} ${next.target_title}`;
        document.getElementById('lp-progress-text').textContent = `${next.progress_percent}%`;
        document.getElementById('lp-progress-fill').style.width = `${next.progress_percent}%`;
        document.getElementById('lp-remaining-text').textContent = next.remaining > 0 ? 
            `ขาดอีกเพียง ${next.remaining} ครั้ง จะได้รับเข็มและสวัสดิการเป้าหมายนี้` : 
            `คุณบรรลุเป้าหมายการบริจาคระดับนี้เรียบร้อยแล้ว!`;

        // Render earned milestones
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

/* ==========================================================================
   8. Donors Directory & Live Table Search
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
            if (data.donors.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 30px;">ไม่พบข้อมูลผู้บริจาคในระบบ</td></tr>`;
                return;
            }

            let rowsHtml = '';
            data.donors.forEach(d => {
                let milestoneBadge = '<span class="badge-benefit">ผู้บริจาคทั่วไป</span>';
                if (d.donation_count >= 24) {
                    milestoneBadge = '<span class="badge-benefit gold">🏆 สิทธิยกเว้นค่าห้อง/ค่ารักษา (24+)</span>';
                } else if (d.donation_count >= 7) {
                    milestoneBadge = '<span class="badge-benefit gold">🎗️ ตรวจสุขภาพฟรี (7+)</span>';
                } else if (d.donation_count >= 1) {
                    milestoneBadge = '<span class="badge-benefit">🏅 ผู้บริจาคใหม่ (1+)</span>';
                }

                rowsHtml += `
                    <tr>
                        <td>#${d.donor_id}</td>
                        <td><strong>${d.name}</strong><br><small style="color:#64748b;">${d.phone}</small></td>
                        <td>${d.age} ปี / ${d.gender}</td>
                        <td>${d.weight} kg</td>
                        <td><span class="blood-badge ${d.blood_type}">${d.blood_type}${d.rh_factor}</span></td>
                        <td><strong class="text-crimson" style="font-size:1.05rem;">${d.donation_count}</strong> ครั้ง</td>
                        <td>${d.last_donation_date || '<span style="color:#94a3b8;">ยังไม่เคย</span>'}</td>
                        <td>${milestoneBadge}</td>
                        <td>
                            <button class="btn btn-secondary btn-sm" onclick="openDonorModal(${d.donor_id})">ดูประวัติ & สิทธิ</button>
                        </td>
                    </tr>
                `;
            });

            tableBody.innerHTML = rowsHtml;
        }
    } catch (err) {
        console.error('Error loading donors table:', err);
    }
}

/* ==========================================================================
   9. Donor Detail Modal
   ========================================================================== */
async function openDonorModal(donorId) {
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

            // Milestones list
            const milestonesContainer = document.getElementById('modal-milestones-list');
            let mHtml = '';
            d.milestone_benefits.forEach(m => {
                if (m.unlocked) {
                    mHtml += `<div class="badge-benefit gold" style="display:inline-block; margin: 4px; padding: 6px 12px; font-size: 0.85rem;">${m.badge_icon} ${m.title}</div>`;
                }
            });
            milestonesContainer.innerHTML = mHtml || '<span style="color:#94a3b8;">ยังไม่บรรลุเกณฑ์สวัสดิการสะสม</span>';

            // History table
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

/* ==========================================================================
   10. Toast Notification System
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
