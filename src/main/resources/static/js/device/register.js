// 학교 선택 시 관리번호 카테고리 로드
function loadManageCates(schoolId) {
    fetch(`/api/manages/cates/${schoolId}`)
        .then(response => response.json())
        .then(cates => {
            const cateSelect = document.getElementById('manageCate');
            cateSelect.innerHTML = '<option value="">선택하세요</option>';
            cates.forEach(cate => {
                const option = document.createElement('option');
                option.value = cate;
                option.textContent = cate;
                cateSelect.appendChild(option);
            });
        });
}

// 관리번호 카테고리 선택 시 연도 로드
function loadYears(schoolId, manageCate) {
    fetch(`/api/manages/years/${schoolId}/${manageCate}`)
        .then(response => response.json())
        .then(years => {
            const yearSelect = document.getElementById('year');
            yearSelect.innerHTML = '<option value="">선택하세요</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });
        });
}

// 연도 선택 시 번호 목록 로드
function loadManageNums(schoolId, manageCate, year) {
    let url = `/api/manages/nums/${schoolId}/${manageCate}`;
    if (year) {
        url += `?year=${year}`;
    }
    fetch(url)
        .then(response => response.json())
        .then(nums => {
            const numSelect = document.getElementById('manageNum');
            numSelect.innerHTML = '<option value="">선택하세요</option>';
            
            if (nums && nums.length > 0) {
                // 마지막 번호+1만 표시
                const sortedNums = nums.sort((a, b) => a - b);
                const lastNum = sortedNums[sortedNums.length - 1]; // 마지막 번호 (신규)
                
                const nextOption = document.createElement('option');
                nextOption.value = lastNum;
                nextOption.textContent = lastNum + ' (신규)';
                nextOption.selected = true;
                numSelect.appendChild(nextOption);
            } else {
                // 번호가 없는 경우 1번을 신규로 추가
                const nextOption = document.createElement('option');
                nextOption.value = 1;
                nextOption.textContent = '1 (신규)';
                nextOption.selected = true;
                numSelect.appendChild(nextOption);
            }
            
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = '직접입력';
            numSelect.appendChild(customOption);
        });
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    const schoolSelect = document.getElementById('school');
    const cateSelect = document.getElementById('manageCate');
    const yearSelect = document.getElementById('year');
    
    schoolSelect.addEventListener('change', function() {
        if (this.value) {
            loadManageCates(this.value);
        }
    });
    
    cateSelect.addEventListener('change', function() {
        if (schoolSelect.value && this.value) {
            loadYears(schoolSelect.value, this.value);
            loadManageNums(schoolSelect.value, this.value, yearSelect.value);
        }
    });
    
    yearSelect.addEventListener('change', function() {
        if (schoolSelect.value && cateSelect.value) {
            loadManageNums(schoolSelect.value, cateSelect.value, this.value);
        }
    });

    var manageCate = document.getElementById('manageCate');
    var manageCateInput = document.getElementById('manageCateInput');
    var year = document.getElementById('year');
    var manageYearInput = document.getElementById('manageYearInput');

    if (manageCate) {
        manageCate.addEventListener('change', function() {
            if (this.value === 'custom') {
                manageCateInput.style.display = 'inline-block';
            } else {
                manageCateInput.style.display = 'none';
            }
        });
    }
    if (year) {
        year.addEventListener('change', function() {
            if (this.value === 'custom') {
                manageYearInput.style.display = 'inline-block';
            } else {
                manageYearInput.style.display = 'none';
            }
        });
    }

    // manageNum select에 직접입력 이벤트 추가
    const manageNum = document.getElementById('manageNum');
    const manageNumInput = document.getElementById('manageNumInput');
    if (manageNum) {
        manageNum.addEventListener('change', function() {
            if (this.value === 'custom') {
                manageNumInput.style.display = 'inline-block';
            } else {
                manageNumInput.style.display = 'none';
            }
        });
    }
}); 