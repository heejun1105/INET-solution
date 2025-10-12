import FloorPlanManager from './modules/FloorPlanManager.js';
import ScrollFixManager from './modules/ScrollFixManager.js';
import FloorplanViewer from './modules/FloorplanViewer.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 학교 평면도 관리 모듈 초기화');
    
    // 도형 관련 CSS 스타일 추가
    addShapeStyles();
    
    const floorPlanManager = new FloorPlanManager();
    let floorplanViewer = null;
    
    // 전역에서 접근 가능하도록 설정
    window.floorPlanManager = floorPlanManager;
    window.exitDesignMode = exitDesignMode;
    
    // 현재 모드 상태
    let currentMode = null; // 'design' 또는 'view' 또는 null (초기 상태)
    let selectedSchool = null; // 선택된 학교 정보
    let schoolList = []; // 학교 목록
    let currentModalMode = null; // 'design' 또는 'view'
    
    // 모드 전환 버튼 이벤트
    const designModeBtn = document.getElementById('designModeBtn');
    if (designModeBtn) {
        designModeBtn.addEventListener('click', () => {
            switchToDesignMode();
        });
    } else {
        console.warn('⚠️ designModeBtn 요소를 찾을 수 없습니다.');
    }
    
    const viewModeBtn = document.getElementById('viewModeBtn');
    if (viewModeBtn) {
        viewModeBtn.addEventListener('click', () => {
            switchToViewMode();
        });
    } else {
        console.warn('⚠️ viewModeBtn 요소를 찾을 수 없습니다.');
    }
    
    // 학교 선택 버튼 이벤트
    const designSchoolSelectBtn = document.getElementById('designSchoolSelectBtn');
    if (designSchoolSelectBtn) {
        designSchoolSelectBtn.addEventListener('click', () => {
            openSchoolSelectModal('design');
        });
    } else {
        console.warn('⚠️ designSchoolSelectBtn 요소를 찾을 수 없습니다.');
    }
    
    const viewSchoolSelectBtn = document.getElementById('viewSchoolSelectBtn');
    if (viewSchoolSelectBtn) {
        viewSchoolSelectBtn.addEventListener('click', () => {
            openSchoolSelectModal('view');
        });
    } else {
        console.warn('⚠️ viewSchoolSelectBtn 요소를 찾을 수 없습니다.');
    }
    
    // PPT 다운로드 버튼 이벤트 (보기 모드)
    const viewPptDownloadBtn = document.getElementById('viewPptDownloadBtn');
    if (viewPptDownloadBtn) {
        viewPptDownloadBtn.addEventListener('click', () => {
            downloadPPT();
        });
    } else {
        console.warn('⚠️ viewPptDownloadBtn 요소를 찾을 수 없습니다.');
    }
    
    // 학교 선택 모달 이벤트
    const closeSchoolModal = document.getElementById('closeSchoolModal');
    if (closeSchoolModal) {
        closeSchoolModal.addEventListener('click', () => {
            closeSchoolSelectModal();
        });
    } else {
        console.warn('⚠️ closeSchoolModal 요소를 찾을 수 없습니다.');
    }
    
    const cancelSchoolSelect = document.getElementById('cancelSchoolSelect');
    if (cancelSchoolSelect) {
        cancelSchoolSelect.addEventListener('click', () => {
            closeSchoolSelectModal();
        });
    } else {
        console.warn('⚠️ cancelSchoolSelect 요소를 찾을 수 없습니다.');
    }
    
    const confirmSchoolSelect = document.getElementById('confirmSchoolSelect');
    if (confirmSchoolSelect) {
        confirmSchoolSelect.addEventListener('click', () => {
            confirmSchoolSelection();
        });
    } else {
        console.warn('⚠️ confirmSchoolSelect 요소를 찾을 수 없습니다.');
    }
    
    // 모달 외부 클릭 시 닫기
    const schoolSelectModal = document.getElementById('schoolSelectModal');
    if (schoolSelectModal) {
        schoolSelectModal.addEventListener('click', (e) => {
            if (e.target.id === 'schoolSelectModal') {
                closeSchoolSelectModal();
            }
        });
    } else {
        console.warn('⚠️ schoolSelectModal 요소를 찾을 수 없습니다.');
    }
    
    // 검색 기능
    const schoolSearchInput = document.getElementById('schoolSearchInput');
    if (schoolSearchInput) {
        schoolSearchInput.addEventListener('input', (e) => {
            filterSchools(e.target.value);
        });
    } else {
        console.warn('⚠️ schoolSearchInput 요소를 찾을 수 없습니다.');
    }
    
    // 설계 모드로 전환 (전체화면 모드)
    function switchToDesignMode() {
        currentMode = 'design';
        
        // UI 업데이트
        document.getElementById('designModeBtn').classList.add('active');
        document.getElementById('viewModeBtn').classList.remove('active');
        
        // 기존 컨테이너 숨기기
        document.getElementById('viewModeContainer').classList.remove('active');
        
        // DesignModeManager를 통한 전체화면 설계모드 진입
        if (floorPlanManager.designModeManager) {
            floorPlanManager.designModeManager.enterDesignMode();
        } else {
            console.log('DesignModeManager 초기화 대기 중...');
            // DesignModeManager가 초기화될 때까지 대기
            const checkDesignModeManager = () => {
                if (floorPlanManager.designModeManager) {
                    floorPlanManager.designModeManager.enterDesignMode();
                } else {
                    setTimeout(checkDesignModeManager, 100);
                }
            };
            checkDesignModeManager();
        }
        
        console.log('✅ 전체화면 설계 모드로 전환');
    }
    
    // 설계 모드 종료
    function exitDesignMode() {
        currentMode = null;
        selectedSchool = null;
        
        // 설계모드 관련 요소들 완전 제거
        const designElements = document.querySelectorAll('.design-toolbar, .grid-overlay, .context-menu');
        designElements.forEach(element => {
            if (element && element.parentNode) {
                element.remove();
            }
        });
        
        // UI 업데이트
        document.getElementById('designModeBtn').classList.remove('active');
        document.getElementById('viewModeBtn').classList.remove('active');
        document.getElementById('viewModeContainer').classList.remove('active');
        
        // 학교 선택 버튼 초기화
        const designSchoolBtn = document.getElementById('designSchoolSelectBtn');
        if (designSchoolBtn) {
            designSchoolBtn.innerHTML = `
                <i class="fas fa-school"></i>
                <span>학교 선택</span>
                <small>평면도를 그릴 학교를 선택하세요</small>
            `;
            designSchoolBtn.style.background = '';
            designSchoolBtn.style.borderColor = '';
        }
        
        console.log('✅ 설계 모드 종료');
    }
    
    
    // 보기 모드로 전환
    function switchToViewMode() {
        currentMode = 'view';
        
        // UI 업데이트
        document.getElementById('designModeBtn').classList.remove('active');
        document.getElementById('viewModeBtn').classList.add('active');
        document.getElementById('designModeContainer').classList.remove('active');
        document.getElementById('viewModeContainer').classList.add('active');
        
        // 보기 모드 초기화
        initializeViewMode();
        
        console.log('✅ 보기 모드로 전환');
    }
    
    // 보기 모드 초기화
    function initializeViewMode() {
        // FloorplanViewer 초기화
        if (!floorplanViewer) {
            floorplanViewer = new FloorplanViewer();
        }
        
        // 뷰어 컨테이너 초기화
        if (floorplanViewer) {
            floorplanViewer.initViewerContainer();
            
            // 뷰어 컨테이너가 제대로 초기화되었는지 확인
            if (!floorplanViewer.viewerContainer) {
                console.error('❌ 뷰어 컨테이너 초기화 실패');
                showNotification('뷰어 초기화에 실패했습니다.', 'error');
                return;
            }
            
            console.log('✅ 뷰어 컨테이너 초기화 성공');
        }
        
        console.log('✅ 보기 모드 초기화 완료');
    }
    
    // 특정 학교의 평면도를 뷰어에 로드
    function loadViewerForSchool(schoolId) {
        if (floorplanViewer) {
            floorplanViewer.loadFloorPlan(schoolId);
        }
    }
    
    // 학교 목록 로드
    async function loadSchools() {
        try {
            const response = await fetch('/school/api/schools');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 학교 목록을 불러올 수 없습니다.`);
            }
            const data = await response.json();
            schoolList = data;
            console.log('✅ 학교 목록 로드 성공:', data.length, '개 학교');
            return data;
        } catch (error) {
            console.error('학교 목록 로드 실패:', error);
            showNotification(`학교 목록을 불러오는데 실패했습니다: ${error.message}`, 'error');
            return [];
        }
    }
    
    // 학교 선택 모달 열기
    async function openSchoolSelectModal(mode) {
        currentModalMode = mode;
        const modal = document.getElementById('schoolSelectModal');
        const schoolListContainer = document.getElementById('schoolList');
        
        // 모달 먼저 표시
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // 로딩 상태 표시
        schoolListContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <p>학교 목록을 불러오는 중...</p>
            </div>
        `;
        
        try {
            // 학교 목록 로드
            const schools = await loadSchools();
            
            // 학교 목록 렌더링
            schoolListContainer.innerHTML = '';
            
            if (schools.length === 0) {
                schoolListContainer.innerHTML = `
                    <div class="no-schools-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>등록된 학교가 없습니다.</p>
                        <small>관리자에게 문의하세요.</small>
                    </div>
                `;
                return;
            }
            
            schools.forEach(school => {
                const schoolItem = document.createElement('div');
                schoolItem.className = 'school-item';
                schoolItem.dataset.schoolId = school.id;
                schoolItem.innerHTML = `
                    <div class="school-icon">
                        <i class="fas fa-school"></i>
                    </div>
                    <div class="school-info">
                        <div class="school-name">${school.schoolName || school.name || '이름 없음'}</div>
                        <div class="school-address">${school.address || school.schoolAddress || '주소 정보 없음'}</div>
                    </div>
                `;
                
                schoolItem.addEventListener('click', () => {
                    selectSchool(schoolItem, school);
                });
                
                schoolListContainer.appendChild(schoolItem);
            });
            
        } catch (error) {
            // 에러 발생 시 에러 메시지 표시
            schoolListContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>학교 목록을 불러올 수 없습니다.</p>
                    <small>${error.message}</small>
                    <button onclick="openSchoolSelectModal('${mode}')" class="retry-btn">
                        <i class="fas fa-redo"></i> 다시 시도
                    </button>
                </div>
            `;
        }
        
        // 검색 입력 초기화
        document.getElementById('schoolSearchInput').value = '';
    }
    
    // 학교 선택 모달 닫기
    function closeSchoolSelectModal() {
        const modal = document.getElementById('schoolSelectModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // 선택 상태 초기화
        document.querySelectorAll('.school-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.getElementById('confirmSchoolSelect').disabled = true;
    }
    
    // 학교 선택
    function selectSchool(schoolItem, school) {
        // 이전 선택 해제
        document.querySelectorAll('.school-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 현재 선택
        schoolItem.classList.add('selected');
        document.getElementById('confirmSchoolSelect').disabled = false;
        
        // 선택된 학교 정보 저장
        selectedSchool = school;
    }
    
    // 학교 선택 확인
    function confirmSchoolSelection() {
        if (!selectedSchool) {
            showNotification('학교를 선택해주세요.', 'warning');
            return;
        }
        
        if (currentModalMode === 'design') {
            // 설계 모드에서 학교 선택
            updateDesignSchoolButton(selectedSchool);
            initializeDesignMode();
            showNotification(`${selectedSchool.schoolName || selectedSchool.name} 설계 모드로 전환`, 'success');
        } else if (currentModalMode === 'view') {
            // 보기 모드에서 학교 선택
            updateViewSchoolButton(selectedSchool);
            
            // 뷰어 컨테이너 재초기화
            if (floorplanViewer) {
                floorplanViewer.initViewerContainer();
                
                // 뷰어 컨테이너 확인
                if (!floorplanViewer.viewerContainer) {
                    showNotification('뷰어 초기화에 실패했습니다.', 'error');
                    return;
                }
            }
            
            loadViewerForSchool(selectedSchool.id);
            
            // 보기 모드에서도 자동 화면 맞춤 실행
            setTimeout(() => {
                if (floorplanViewer && floorplanViewer.centerView) {
                    floorplanViewer.centerView();
                    console.log('🎯 보기 모드 자동 화면 맞춤 실행');
                }
            }, 500);
            
            showNotification(`${selectedSchool.schoolName || selectedSchool.name} 보기 모드로 전환`, 'success');
        }
        
        closeSchoolSelectModal();
    }
    
    // 설계 모드 학교 버튼 업데이트
    function updateDesignSchoolButton(school) {
        const btn = document.getElementById('designSchoolSelectBtn');
        const schoolName = school.schoolName || school.name || '이름 없음';
        btn.innerHTML = `
            <i class="fas fa-school"></i>
            <span>${schoolName}</span>
            <small>평면도 설계 중</small>
        `;
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        btn.style.borderColor = '#10b981';
    }
    
    // 보기 모드 학교 버튼 업데이트
    function updateViewSchoolButton(school) {
        const btn = document.getElementById('viewSchoolSelectBtn');
        const schoolName = school.schoolName || school.name || '이름 없음';
        btn.innerHTML = `
            <i class="fas fa-school"></i>
            <span>${schoolName}</span>
            <small>평면도 보기 중</small>
        `;
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        btn.style.borderColor = '#10b981';
        
        // PPT 다운로드 버튼 표시
        const pptBtn = document.getElementById('viewPptDownloadBtn');
        if (pptBtn) {
            pptBtn.style.display = 'inline-flex';
        }
    }
    
    // PPT 다운로드 함수
    function downloadPPT() {
        if (!selectedSchool) {
            showNotification('학교를 먼저 선택해주세요.', 'warning');
            return;
        }
        
        const schoolId = selectedSchool.id || selectedSchool.schoolId;
        if (!schoolId) {
            showNotification('학교 ID를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 로딩 알림 표시
        showNotification('PPT 파일을 생성하는 중입니다...', 'info');
        
        // PPT 다운로드 API 호출
        fetch(`/floorplan/export/ppt?schoolId=${schoolId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`PPT 생성 실패: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Blob을 파일로 다운로드
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // 파일명 생성
            const schoolName = selectedSchool.schoolName || selectedSchool.name || '학교';
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            a.download = `평면도_${schoolName}_${date}.pptx`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('PPT 파일이 다운로드되었습니다.', 'success');
        })
        .catch(error => {
            console.error('PPT 다운로드 오류:', error);
            showNotification('PPT 다운로드에 실패했습니다: ' + error.message, 'error');
        });
    }
    
    // 학교 검색 필터링
    function filterSchools(searchTerm) {
        const schoolItems = document.querySelectorAll('.school-item');
        const term = searchTerm.toLowerCase();
        
        schoolItems.forEach(item => {
            const schoolName = item.querySelector('.school-name').textContent.toLowerCase();
            const schoolAddress = item.querySelector('.school-address').textContent.toLowerCase();
            
            if (schoolName.includes(term) || schoolAddress.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    // 알림 메시지 표시
    function showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // 스타일 적용
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        
        // 애니메이션 CSS 추가
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                }
                .notification-close:hover {
                    opacity: 0.8;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // 닫기 버튼 이벤트
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });
        
        // 자동 제거 (5초 후)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    // 알림 아이콘 가져오기
    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'info': return 'fa-info-circle';
            default: return 'fa-info-circle';
        }
    }
    
    // 알림 색상 가져오기
    function getNotificationColor(type) {
        switch (type) {
            case 'success': return '#10b981';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6b7280';
        }
    }
    
    // 초기화
    console.log('✅ 평면도 페이지 초기화 완료 - 모드를 선택해주세요');
    
    // 모드 탭 이벤트 바인딩


    // 스크롤 고정 관리자 초기화 (도구바, 미배치교실 패널, 확대/축소 컨트롤)
    const scrollFixManager = new ScrollFixManager({
        items: [
            {
                element: document.querySelector('.toolbar.active'),
                fixedClass: 'fixed',
                offset: 60 // 네비바 높이
            },
            {
                element: document.getElementById('unplacedRoomsPanel'),
                fixedClass: 'fixed',
                offset: 140 // 네비바(60px) + 도구모음 높이(약 80px)
            },
            {
                element: document.querySelector('.panel-toggle'),
                fixedClass: 'fixed',
                offset: 175 // 네비바(60px) + 도구모음 높이(약 80px) + 여유 공간(35px)
            },
            {
                element: document.querySelector('.zoom-controls'),
                fixedClass: 'fixed',
                offset: 140 // 네비바(60px) + 도구모음 높이(약 80px)
            }
        ],
        scrollContainer: window,
        scrollTarget: document.querySelector('.canvas-container')
    });
    
    // 윈도우 객체에 스크롤 고정 관리자 저장 (다른 모듈에서 접근 가능하도록)
    window.scrollFixManager = scrollFixManager;
    
    // 알림 메시지 자동 숨김 기능
    document.querySelectorAll('.notification').forEach(notification => {
        notification.addEventListener('click', () => {
            notification.classList.remove('show');
        });
    });
    
    // 캔버스 클릭 이벤트 방지 (버블링 중지)
    const canvas = document.getElementById('canvasContent');
    if (canvas) {
        canvas.addEventListener('click', e => {
            if (e.target === canvas) {
                e.stopPropagation();
            }
        });
    }

    // 드롭다운 메뉴 초기화
    initDropdowns();
    
    // 도형도 같이 움직일 수 있도록 그룹 드래그에 포함
    const dragManager = floorPlanManager.dragManager;
    const originalIsValidDraggable = dragManager.isValidDraggable;

    // 기존의 isValidDraggable 함수를 오버라이드하여 도형도 드래그 가능하게 설정
    dragManager.isValidDraggable = function(element) {
        if (element.classList.contains('shape')) {
            return true;
        }
        return originalIsValidDraggable.call(dragManager, element);
    };
    
    console.log('✅ 학교 평면도 관리 모듈 초기화 완료');
});

// 도형 관련 CSS 스타일 추가
function addShapeStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* 도형 요소 공통 스타일 */
        .shape {
            position: absolute;
            box-sizing: border-box;
            cursor: move;
            transition: outline 0.15s ease-in-out;
        }
        
        /* 도형 호버 효과 */
        .shape:hover {
            outline: 2px dashed #3b82f6;
            outline-offset: 2px;
            z-index: 1000 !important;
        }
        
        /* 선택된 도형 스타일 */
        .shape.selected {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
            z-index: 1001 !important;
        }
        
        /* 복수 선택된 도형 스타일 */
        .shape.multi-selected {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
            z-index: 1001 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        
        /* 도형 유형별 스타일 */
        .shape-line, .shape-arrow, .shape-dashed {
            transform-origin: center;
        }
        
        /* 다중 선택 정보 표시 */
        #multiSelectInfo {
            position: fixed;
            top: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            display: none;
            z-index: 2000;
            transition: opacity 0.3s ease;
            max-width: 200px;
            text-align: center;
        }
        
        #multiSelectInfo.show {
            display: block;
        }
    `;
    document.head.appendChild(styleElement);
    
    // 다중 선택 정보 표시 요소 추가
    const multiSelectInfo = document.createElement('div');
    multiSelectInfo.id = 'multiSelectInfo';
    multiSelectInfo.innerHTML = '<span id="multiSelectText">0개 요소 선택됨</span>';
    document.body.appendChild(multiSelectInfo);
}

// 드롭다운 메뉴 초기화
function initDropdowns() {
    // 도형 드롭다운 버튼 이벤트 설정
    const shapeButton = document.getElementById('shapeButton');
    const shapeDropdown = document.getElementById('shapeDropdown');
    
    if (shapeButton && shapeDropdown) {
        // 드롭다운 메뉴 초기 상태 (숨김)
        shapeDropdown.classList.remove('show');
    }
    
    // 기타공간 드롭다운 버튼 이벤트 설정
    const otherSpaceButton = document.getElementById('otherSpaceButton');
    const otherSpaceDropdown = document.getElementById('otherSpaceDropdown');
    
    if (otherSpaceButton && otherSpaceDropdown) {
        // 드롭다운 메뉴 초기 상태 (숨김)
        otherSpaceDropdown.classList.remove('show');
    }
}