/**
 * main_new_v3.js
 * 평면도 시스템 메인 진입점 (리빌딩 버전)
 * 
 * 전체 애플리케이션 통합 및 모드 관리
 */

import FloorPlanCore from './core/FloorPlanCore.js';
import ElementManager from './core/ElementManager.js';
import InteractionManager from './core/InteractionManager.js';
import DataSyncManager from './core/DataSyncManager.js';
import UIManager from './core/UIManager.js';
import HistoryManager from './core/HistoryManager.js';

import ClassroomDesignMode from './modes/ClassroomDesignMode.js';
import WirelessApDesignMode from './modes/WirelessApDesignMode.js';
import SeatLayoutMode from './modes/SeatLayoutMode.js';
import EquipmentViewMode from './modes/EquipmentViewMode.js';
import WirelessApViewMode from './modes/WirelessApViewMode.js';

/**
 * 평면도 애플리케이션
 */
class FloorPlanApp {
    constructor() {
        this.core = null;
        this.elementManager = null;
        this.interactionManager = null;
        this.dataSyncManager = null;
        this.uiManager = null;
        this.historyManager = null;
        
        this.currentSchoolId = null;
        this.currentMode = null; // 'design-classroom', 'design-wireless', 'design-seat', 'view-equipment', 'view-wireless'
        this.modeManager = null;
        
        this.schools = [];
        
        // 페이지 관리
        this.currentPage = 1; // 현재 페이지 번호
        this.maxPage = 1; // 최대 페이지 번호
        this.deletedPages = []; // 삭제 예정인 페이지 번호 목록 (저장 시 실제 삭제)
        this.localElementsByPage = {}; // 페이지별 로컬 요소 저장 (저장되지 않은 요소)
        
        // 첫 진입 여부 확인 (localStorage 사용)
        this.isFirstEntry = !localStorage.getItem('floorplan_has_entered');
        
        console.log('🚀 FloorPlanApp 초기화');
    }
    
    /**
     * 초기화
     */
    async init() {
        try {
            // 워크스페이스 컨테이너 확인 (초기에는 숨김)
            const workspaceCanvasWrapper = document.getElementById('workspace-canvas-wrapper');
            if (!workspaceCanvasWrapper) {
                console.error('Workspace canvas wrapper not found');
                // 폴백: 기존 canvas 사용
                const container = document.getElementById('canvas');
                if (container) {
                    this.initCore(container);
                }
            } else {
                // 워크스페이스용 컨테이너에 초기화 (아직 표시 안함)
                this.initCore(workspaceCanvasWrapper);
            }
            
            // UI 설정
            this.setupUI();
            
            // 페이지 UI 생성
            this.createPageNavigationUI();
            
            // 학교 목록 로드
            await this.loadSchools();
            
            console.log('✅ FloorPlanApp 초기화 완료');
        } catch (error) {
            console.error('초기화 오류:', error);
            alert('평면도 시스템 초기화 중 오류가 발생했습니다.');
        }
    }
    
    /**
     * 코어 초기화
     */
    initCore(container) {
        // 코어 모듈 초기화
        this.core = new FloorPlanCore(container, {
            canvasWidth: 24000, // 기본 교실 크기 120px * 200배
            canvasHeight: 16000,
            zoom: 0.5
        });
        
        this.elementManager = new ElementManager(this.core);
        this.historyManager = new HistoryManager(this.core);
        this.dataSyncManager = new DataSyncManager(this.core, this.elementManager);
        this.uiManager = new UIManager(this.core, this.dataSyncManager, this.elementManager);
        this.interactionManager = new InteractionManager(this.core, this.elementManager, this.historyManager);
        
        // Core에 schoolId 및 현재 페이지 정보 저장
        this.core.currentSchoolId = null;
        this.core.currentPage = 1;
        
        // FloorPlanApp 인스턴스를 전역으로 저장 (DataSyncManager에서 접근 가능하도록)
        window.floorPlanApp = this;
    }

    // 뷰포트 크기 변화에 맞춰 배율/팬을 보정 (필요 시만 확대)
    fitCanvasToViewportDebounced() {
        clearTimeout(this._fitTimer);
        this._fitTimer = setTimeout(() => this.fitCanvasToViewport(), 80);
    }

    fitCanvasToViewport() {
        try {
            if (!this.core || !this.core.canvas) return;
            const container = document.querySelector('.workspace-canvas-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            // 최소 맞춤 줌 계산 (코어 제공 메서드 사용)
            const minZoom = (typeof this.core.getMinZoomToFitCanvas === 'function')
                ? this.core.getMinZoomToFitCanvas()
                : this.core.state.zoom;

            const currentZoom = this.core.state.zoom || 1.0;
            const targetZoom = Math.max(minZoom, currentZoom);

            // 화면 중앙을 기준으로 줌 적용 (screen 좌표)
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            if (typeof this.core.setZoom === 'function') {
                this.core.setZoom(targetZoom, centerX, centerY);
            } else {
                this.core.setState({ zoom: targetZoom });
            }

            // pan 클램프 유도 (코어의 setPan이 내부 클램프 처리 가정)
            if (typeof this.core.setPan === 'function') {
                this.core.setPan(this.core.state.panX, this.core.state.panY);
            }

            this.core.markDirty();
            this.core.render && this.core.render();
            if (window.floorPlanApp && window.floorPlanApp.updateZoomDisplay) {
                window.floorPlanApp.updateZoomDisplay();
            }
        } catch (err) {
            console.warn('fitCanvasToViewport 오류:', err);
        }
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        // 설계 모드 버튼 (초기 화면)
        const designModeBtn = document.getElementById('designModeBtn');
        if (designModeBtn) {
            designModeBtn.addEventListener('click', () => this.openWorkspace('design'));
        }
        
        // 보기 모드 버튼 (초기 화면)
        const viewModeBtn = document.getElementById('viewModeBtn');
        if (viewModeBtn) {
            viewModeBtn.addEventListener('click', () => this.openWorkspace('view'));
        }
        
        // 워크스페이스 모달 내 컨트롤
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        const workspaceSaveBtn = document.getElementById('workspace-save-btn');
        const workspacePptBtn = document.getElementById('workspace-ppt-btn');
        const workspaceCloseBtn = document.getElementById('workspace-close-btn');
        
        if (workspaceSchoolSelect) {
            workspaceSchoolSelect.addEventListener('change', (e) => this.onWorkspaceSchoolChange(e.target.value));
        }
        
        if (workspaceModeSelect) {
            workspaceModeSelect.addEventListener('change', (e) => this.onWorkspaceModeChange(e.target.value));
        }
        
        if (workspaceSaveBtn) {
            workspaceSaveBtn.addEventListener('click', () => this.saveCurrentWork());
        }
        
        if (workspacePptBtn) {
            workspacePptBtn.addEventListener('click', () => this.downloadPPT());
        }
        
        if (workspaceCloseBtn) {
            workspaceCloseBtn.addEventListener('click', () => this.closeWorkspace());
        }
        
        // 배율 조정 버튼
        this.setupZoomControls();
        
        // 장비 폰트 크기 조절
        const equipmentFontSizeInput = document.getElementById('equipment-font-size-input');
        if (equipmentFontSizeInput) {
            equipmentFontSizeInput.addEventListener('input', (e) => {
                const fontSize = parseInt(e.target.value) || 28;
                if (this.core) {
                    // Core에 폰트 크기 저장
                    this.core.equipmentFontSize = fontSize;
                    
                    // 학교별 폰트 크기 localStorage에 저장
                    if (this.currentSchoolId) {
                        const storageKey = `equipmentFontSize_${this.currentSchoolId}`;
                        localStorage.setItem(storageKey, fontSize.toString());
                        console.log(`💾 장비 폰트 크기 저장 (학교 ${this.currentSchoolId}): ${fontSize}px`);
                    }
                    
                    // 장비 텍스트 재렌더링
                    if (this.modeManager && this.currentMode === 'view-equipment') {
                        this.modeManager.renderEquipmentCards();
                        this.core.markDirty();
                        this.core.render && this.core.render();
                    }
                }
            });
        }
        
        // 저장 버튼 (설계 모드용)
        const saveBtn = document.getElementById('workspace-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }
        
        // 보기 버튼 (설계 모드용)
        const viewBtn = document.getElementById('workspace-view-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.switchToViewMode());
        }
        
        // 설계 버튼 (보기 모드용)
        const designBtn = document.getElementById('workspace-design-btn');
        if (designBtn) {
            designBtn.addEventListener('click', () => this.switchToDesignMode());
        }
        
        // PPT 다운로드 버튼
        const pptBtn = document.getElementById('workspace-ppt-btn');
        if (pptBtn) {
            pptBtn.addEventListener('click', () => this.downloadPPT());
        }

        // 헤더 접기/펼치기 (토글 버튼 하나로 처리)
        const header = document.querySelector('.workspace-header');
        const headerCollapseBtn = document.getElementById('header-collapse-btn');
        if (header && headerCollapseBtn) {
            const toggleIcon = headerCollapseBtn.querySelector('i');
            headerCollapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (header.classList.contains('collapsed')) {
                    // 접힌 상태 → 펼치기
                    header.classList.remove('collapsed');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-up';
                    }
                    headerCollapseBtn.title = '상단 배너 접기';
                } else {
                    // 펼친 상태 → 접기
                    header.classList.add('collapsed');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-down';
                    }
                    headerCollapseBtn.title = '상단 배너 펼치기';
                }
                
                // 레이아웃 변화 후 배율/팬 자동 보정
                this.fitCanvasToViewportDebounced();
            });
        }

        // 헤더 스크롤 시 캔버스로 이벤트 전파 방지
        const workspaceHeader = document.querySelector('.workspace-header');
        const workspaceControlsCenter = document.querySelector('.workspace-controls-center');
        if (workspaceHeader && workspaceControlsCenter) {
            // 터치 이벤트 전파 방지
            const preventCanvasTouch = (e) => {
                e.stopPropagation();
            };
            workspaceControlsCenter.addEventListener('touchstart', preventCanvasTouch, { passive: true });
            workspaceControlsCenter.addEventListener('touchmove', preventCanvasTouch, { passive: true });
            workspaceControlsCenter.addEventListener('touchend', preventCanvasTouch, { passive: true });
            
            // 스크롤 이벤트 전파 방지
            workspaceControlsCenter.addEventListener('scroll', (e) => {
                e.stopPropagation();
            }, { passive: true });
            
            // 마우스 휠 이벤트 전파 방지
            workspaceControlsCenter.addEventListener('wheel', (e) => {
                const headerHasClassroomMode = workspaceHeader.classList.contains('classroom-mode');
                const isDesktop = window.innerWidth >= 1201;
                
                if (headerHasClassroomMode && isDesktop) {
                    const dominantDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                    if (dominantDelta !== 0) {
                        workspaceControlsCenter.scrollLeft += dominantDelta;
                        if (e.cancelable) {
                            e.preventDefault();
                        }
                    }
                }
                e.stopPropagation();
            }, { passive: false });
            
            // 모바일 및 랩탑에서 헤더 도구 표시 시 스크롤 위치를 맨 왼쪽(레이어부터)으로 리셋
            const resetHeaderScroll = () => {
                if (window.innerWidth <= 1200 && workspaceControlsCenter) {
                    // 첫 번째 요소(레이어 그룹)를 찾아서 scrollIntoView 사용
                    const firstToolGroup = workspaceControlsCenter.querySelector('.header-tool-group:first-child');
                    
                    // 방법 1: scrollLeft를 0으로 직접 설정
                    const setScrollToZero = () => {
                        workspaceControlsCenter.scrollLeft = 0;
                    };
                    
                    // 방법 2: 첫 번째 요소로 스크롤
                    const scrollToFirstElement = () => {
                        if (firstToolGroup) {
                            firstToolGroup.scrollIntoView({ 
                                behavior: 'auto', 
                                block: 'nearest', 
                                inline: 'start' 
                            });
                        }
                    };
                    
                    // 즉시 실행
                    setScrollToZero();
                    requestAnimationFrame(() => {
                        setScrollToZero();
                        scrollToFirstElement();
                    });
                    
                    // 레이아웃 안정화 후 여러 번 재시도
                    const attemptReset = (delay) => {
                        setTimeout(() => {
                            setScrollToZero();
                            scrollToFirstElement();
                        }, delay);
                    };
                    
                    attemptReset(50);
                    attemptReset(100);
                    attemptReset(200);
                    attemptReset(300);
                    attemptReset(500);
                }
            };
            
            // 헤더 도구가 표시될 때 스크롤 리셋
            const headerTools = document.getElementById('workspace-tools');
            if (headerTools) {
                // MutationObserver로 display 변경 감지
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const display = headerTools.style.display;
                            if (display === 'flex' || display === '') {
                                resetHeaderScroll();
                            }
                        }
                    });
                });
                observer.observe(headerTools, { attributes: true, attributeFilter: ['style'] });
                
                // ResizeObserver로 크기 변화 감지 (레이어가 보이도록)
                const resizeObserver = new ResizeObserver(() => {
                    if (window.innerWidth <= 1200) {
                        resetHeaderScroll();
                    }
                });
                resizeObserver.observe(workspaceControlsCenter);
                
                // 초기 상태 확인
                if (headerTools.style.display === 'flex' || getComputedStyle(headerTools).display === 'flex') {
                    resetHeaderScroll();
                }
                
                // 화면 크기 변경 시에도 리셋 (모바일 및 랩탑에서만)
                window.addEventListener('resize', () => {
                    if (window.innerWidth <= 1200) {
                        resetHeaderScroll();
                    }
                });
            }
        }

        // 캔버스 컨테이너 리사이즈 감지하여 배율/팬 자동 보정
        const canvasContainer = document.querySelector('.workspace-canvas-container');
        if (canvasContainer) {
            const resizeObserver = new ResizeObserver(() => {
                // 캔버스가 표시된 상태에서만 리사이즈
                if (this.core && canvasContainer.getBoundingClientRect().width > 0) {
                    this.core.resize();
                    this.fitCanvasToViewportDebounced();
                }
            });
            resizeObserver.observe(canvasContainer);
            this._viewportResizeObserver = resizeObserver;
        }
        // 화면 회전/주소창 변화 등 추가 신호에 반응
        window.addEventListener('orientationchange', () => this.fitCanvasToViewportDebounced());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.fitCanvasToViewportDebounced());
        }
        
        // 키보드 단축키 설정
        this.setupKeyboardShortcuts();
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Ctrl+Z: 되돌리기
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }
            
            // Ctrl+Y 또는 Ctrl+Shift+Z: 다시 실행
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
                return;
            }
        });
        
        console.log('⌨️ 키보드 단축키 설정 완료');
    }
    
    /**
     * 되돌리기
     */
    undo() {
        if (!this.historyManager) {
            console.warn('⚠️ HistoryManager가 초기화되지 않았습니다');
            return;
        }
        
        const success = this.historyManager.undo();
        if (success) {
            this.uiManager?.showNotification('되돌리기', '이전 작업으로 되돌렸습니다', 'info');
        } else {
            this.uiManager?.showNotification('되돌리기', '되돌릴 작업이 없습니다', 'warning');
        }
    }
    
    /**
     * 다시 실행
     */
    redo() {
        if (!this.historyManager) {
            console.warn('⚠️ HistoryManager가 초기화되지 않았습니다');
            return;
        }
        
        const success = this.historyManager.redo();
        if (success) {
            this.uiManager?.showNotification('다시 실행', '다시 실행했습니다', 'info');
        } else {
            this.uiManager?.showNotification('다시 실행', '다시 실행할 작업이 없습니다', 'warning');
        }
    }
    
    /**
     * 배율 조정 컨트롤 설정
     */
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        const zoomDisplay = document.getElementById('zoom-display');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.core.zoomIn();
                this.updateZoomDisplay();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.core.zoomOut();
                this.updateZoomDisplay();
            });
        }
        
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                this.core.resetZoom();
                this.updateZoomDisplay();
            });
        }
    }
    
    /**
     * 배율 표시 업데이트
     */
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoom-display');
        if (zoomDisplay && this.core) {
            const zoomPercent = Math.round(this.core.state.zoom * 100);
            zoomDisplay.textContent = `${zoomPercent}%`;
        }
    }
    
    /**
     * 학교 목록 로드
     */
    async loadSchools() {
        try {
            // Thymeleaf에서 주입된 schools 변수 사용
            if (typeof schools !== 'undefined') {
                this.schools = schools;
            } else {
                this.schools = [];
            }
            
            console.log('학교 목록 로드:', this.schools.length);
        } catch (error) {
            console.error('학교 목록 로드 오류:', error);
        }
    }
    
    /**
     * 학교 선택 모달 표시
     */
    showSchoolSelectModal() {
        const modal = document.getElementById('schoolSelectModal');
        const schoolList = document.getElementById('schoolList');
        
        if (!modal || !schoolList) return;
        
        // 학교 목록 렌더링
        schoolList.innerHTML = this.schools.map(school => `
            <div class="school-item" data-school-id="${school.schoolId}">
                <strong>${school.schoolName}</strong>
                <small>${school.address || ''}</small>
            </div>
        `).join('');
        
        // 학교 선택 이벤트
        schoolList.querySelectorAll('.school-item').forEach(item => {
            item.addEventListener('click', () => {
                schoolList.querySelectorAll('.school-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
        // 확인 버튼
        const confirmBtn = document.getElementById('confirmSchoolSelect');
        const cancelBtn = document.getElementById('cancelSchoolSelect');
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const selectedItem = schoolList.querySelector('.school-item.selected');
                if (selectedItem) {
                    const schoolId = parseInt(selectedItem.dataset.schoolId);
                    this.selectSchool(schoolId);
                    modal.classList.remove('active');
                } else {
                    alert('학교를 선택하세요');
                }
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.classList.remove('active');
            };
        }
        
        modal.classList.add('active');
    }
    
    /**
     * 학교 선택
     */
    async selectSchool(schoolId) {
        this.currentSchoolId = schoolId;
        this.core.currentSchoolId = schoolId;
        
        // 현재 페이지를 1로 초기화 (새 학교 선택 시)
        this.currentPage = 1;
        // maxPage는 서버에서 받은 값으로 설정되므로 여기서는 초기화하지 않음
        if (this.core) {
            this.core.currentPage = 1;
        }
        
        const school = this.schools.find(s => s.schoolId === schoolId);
        const schoolName = school ? school.schoolName : `학교 ID: ${schoolId}`;
        
        console.log('✅ 학교 선택:', schoolName);
        this.uiManager.showNotification(`${schoolName} 선택됨`, 'success');
        
        // 평면도 로드
        await this.loadFloorPlan(schoolId);
        
        // 버튼 텍스트 업데이트
        const schoolSelectBtn = document.getElementById('school-select-btn');
        if (schoolSelectBtn) {
            schoolSelectBtn.querySelector('span').textContent = schoolName;
        }
    }
    
    /**
     * 평면도 로드
     */
    async loadFloorPlan(schoolId) {
        try {
            // 삭제 예정 목록 초기화 (새 학교 로드 시)
            this.deletedPages = [];
            // 로컬 요소 저장소 초기화 (새 학교 로드 시)
            this.localElementsByPage = {};
            
            // 먼저 maxPage를 조회 (1페이지를 로드하면서 받아오지만, 실패 시를 대비)
            let maxPageFromServer = null;
            try {
                const maxPageResponse = await fetch(`/floorplan/api/elements?schoolId=${schoolId}&pageNumber=1`);
                if (maxPageResponse.ok) {
                    const maxPageData = await maxPageResponse.json();
                    if (maxPageData.success && maxPageData.maxPage) {
                        maxPageFromServer = maxPageData.maxPage;
                        console.log(`📄 서버에서 최대 페이지 번호 조회: ${maxPageFromServer}`);
                    }
                }
            } catch (error) {
                console.warn('최대 페이지 번호 조회 실패, 요소 로드 시 받아올 예정:', error);
            }
            
            // 현재 페이지의 요소들만 로드
            const result = await this.loadPageElements(this.currentPage);
            
            if (result && result.success) {
                console.log('✅ 평면도 로드 완료');
                
                // 최대 페이지 번호 업데이트 (서버에서 받은 값으로 설정)
                // result.maxPage가 있으면 우선 사용, 없으면 maxPageFromServer 사용
                const finalMaxPage = result.maxPage || maxPageFromServer || 1;
                this.maxPage = finalMaxPage;
                console.log(`📄 최대 페이지 번호 설정: ${this.maxPage}`);
                
                // 현재 페이지의 요소만 필터링 (다른 페이지 요소 제거)
                // pageNumber가 명시적으로 다른 페이지인 요소는 제거
                // 중복 방지: pageNumber가 null/undefined인 요소와 pageNumber === 1인 요소가 중복되지 않도록 처리
                const seenElementIds = new Set();
                this.core.state.elements = this.core.state.elements.filter(el => {
                    if (!el || (!el.id && !el.elementType)) return false;
                    
                    // 중복 체크: 같은 ID의 요소가 이미 포함되었는지 확인
                    const elementId = el.id ? el.id.toString() : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                    if (seenElementIds.has(elementId)) {
                        console.warn(`⚠️ 중복 요소 제거: ${elementId}`);
                        return false;
                    }
                    
                    const elPage = el.pageNumber;
                    // pageNumber가 null/undefined이면 1페이지로 간주
                    const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
                    
                    // 현재 페이지와 일치하는 것만 포함
                    if (normalizedPage === this.currentPage) {
                        seenElementIds.add(elementId);
                        return true;
                    }
                    return false;
                });
                
                console.log(`📄 필터링 후 현재 페이지 ${this.currentPage}의 요소: ${this.core.state.elements.length}개`);
                
                // 첫 로드 시에만 모든 요소가 보이도록 자동 피팅
                // (이미 로드된 상태에서 다시 로드할 때는 이전 시점 유지)
                if (this.core.state.elements.length === 0 || this.isFirstEntry) {
                    this.core.fitToElements();
                }
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
                this.updatePageDisplay(); // 페이지 정보 업데이트
            } else {
                // 기존 방식으로 로드 (하위 호환성)
                const oldResult = await this.dataSyncManager.load(schoolId);
                if (oldResult.success) {
                    console.log('✅ 평면도 로드 완료 (기존 방식)');
                    
                    // maxPage 업데이트 (서버에서 조회한 값 사용)
                    if (maxPageFromServer) {
                        this.maxPage = maxPageFromServer;
                        console.log(`📄 최대 페이지 번호 설정 (기존 방식): ${this.maxPage}`);
                    } else {
                        // 요소들에서 최대 pageNumber 찾기
                        const allPageNumbers = this.core.state.elements
                            .map(el => el.pageNumber)
                            .filter(pageNum => pageNum != null && pageNum !== undefined);
                        if (allPageNumbers.length > 0) {
                            this.maxPage = Math.max(...allPageNumbers, 1);
                            console.log(`📄 요소에서 최대 페이지 번호 추출: ${this.maxPage}`);
                        }
                    }
                    
                    // 현재 페이지의 요소만 필터링 (다른 페이지 요소 제거)
                    // 중복 방지: pageNumber가 null/undefined인 요소와 pageNumber === 1인 요소가 중복되지 않도록 처리
                    const seenElementIds = new Set();
                    this.core.state.elements = this.core.state.elements.filter(el => {
                        if (!el || (!el.id && !el.elementType)) return false;
                        
                        // 중복 체크: 같은 ID의 요소가 이미 포함되었는지 확인
                        const elementId = el.id ? el.id.toString() : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                        if (seenElementIds.has(elementId)) {
                            console.warn(`⚠️ 중복 요소 제거: ${elementId}`);
                            return false;
                        }
                        
                        const elPage = el.pageNumber;
                        // pageNumber가 null/undefined이면 1페이지로 간주
                        const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
                        
                        // 현재 페이지와 일치하는 것만 포함
                        if (normalizedPage === this.currentPage) {
                            seenElementIds.add(elementId);
                            return true;
                        }
                        return false;
                    });
                    
                    console.log(`📄 필터링 후 현재 페이지 ${this.currentPage}의 요소: ${this.core.state.elements.length}개`);
                    
                    if (this.core.state.elements.length === 0 || this.isFirstEntry) {
                        this.core.fitToElements();
                    }
                    this.updateZoomDisplay();
                } else {
                    console.log('ℹ️ 저장된 평면도 없음');
                    // 요소 초기화
                    this.core.state.elements = [];
                    this.maxPage = 1; // 기본값
                    this.updateZoomDisplay();
                }
                this.updatePageDisplay();
            }
            
            // 캔버스 재렌더링 (필터링 후)
            this.core.markDirty();
            this.core.render && this.core.render();
            
            // 보기 모드인 경우 모드 매니저에 알림 (장비 카드 재렌더링 등)
            if (this.modeManager && typeof this.modeManager.onPageSwitch === 'function') {
                this.modeManager.onPageSwitch(this.currentPage);
            }
        } catch (error) {
            console.error('평면도 로드 오류:', error);
        }
    }
    
    /**
     * 설계 모드 메뉴 표시
     */
    showDesignModeMenu() {
        const modes = [
            { id: 'design-classroom', name: '교실 설계', icon: 'fa-door-open' },
            { id: 'design-wireless', name: '무선AP 설계', icon: 'fa-wifi' },
            { id: 'design-seat', name: '자리배치 설계', icon: 'fa-chair' }
        ];
        
        this.showModeSelectionMenu('설계 모드 선택', modes);
    }
    
    /**
     * 보기 모드 메뉴 표시
     */
    showViewModeMenu() {
        const modes = [
            { id: 'view-equipment', name: '장비 모드', icon: 'fa-desktop' },
            { id: 'view-wireless', name: '무선AP 모드', icon: 'fa-wifi' }
        ];
        
        this.showModeSelectionMenu('보기 모드 선택', modes);
    }
    
    /**
     * 모드 선택 메뉴 표시
     */
    showModeSelectionMenu(title, modes) {
        if (!this.currentSchoolId) {
            alert('먼저 학교를 선택하세요');
            return;
        }
        
        const menu = prompt(`${title}\n\n` + modes.map((m, i) => `${i + 1}. ${m.name}`).join('\n'));
        const index = parseInt(menu) - 1;
        
        if (index >= 0 && index < modes.length) {
            this.switchMode(modes[index].id);
        }
    }
    
    /**
     * 모드 전환
     */
    async switchMode(mode) {
        console.log(`🔄 모드 전환: ${mode}`);
        
        // 기존 모드 비활성화
        if (this.modeManager && this.currentMode) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        this.currentMode = mode;
        this.core.state.currentMode = mode;  // Core에도 저장
        
        // 새 모드 활성화
        switch (mode) {
            case 'design-classroom':
                this.modeManager = new ClassroomDesignMode(this.core, this.elementManager, this.uiManager, this.historyManager);
                break;
            case 'design-wireless':
                this.modeManager = new WirelessApDesignMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'design-seat':
                this.modeManager = new SeatLayoutMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'view-equipment':
                this.modeManager = new EquipmentViewMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'view-wireless':
                this.modeManager = new WirelessApViewMode(this.core, this.elementManager, this.uiManager);
                break;
            default:
                console.error('알 수 없는 모드:', mode);
                return;
        }
        
        // 모드 활성화
        if (this.modeManager) {
            try {
                await this.modeManager.activate();
                
                // InteractionManager에 현재 모드 설정 (삭제 콜백용)
                if (this.interactionManager) {
                    this.interactionManager.setCurrentMode(this.modeManager);
                }
                
                // 자리배치설계모드와 무선AP설계모드에서 도구창, 저장 버튼, 토글 버튼 숨김
                const toolbarContainer = document.getElementById('design-toolbar-container');
                const saveBtn = document.getElementById('workspace-save-btn');
                const headerCollapseBtn = document.getElementById('header-collapse-btn');
                const isSeatLayoutMode = mode === 'design-seat';
                const isWirelessApMode = mode === 'design-wireless';
                
                if (toolbarContainer) {
                    toolbarContainer.style.display = isSeatLayoutMode ? 'none' : '';
                }
                if (saveBtn) {
                    saveBtn.style.display = isSeatLayoutMode ? 'none' : 'flex';
                }
                if (headerCollapseBtn) {
                    headerCollapseBtn.style.display = (isSeatLayoutMode || isWirelessApMode) ? 'none' : 'block';
                }
                
                // 캔버스 강제 렌더링
                if (this.core) {
                    this.core.markDirty();
                    this.core.render();
                }
            } catch (error) {
                console.error('❌ 모드 활성화 오류:', error);
                this.uiManager.showNotification('모드 활성화 중 오류가 발생했습니다.', 'error');
                throw error;
            }
        }
        
        this.uiManager.showNotification(`${mode} 활성화`, 'success');
    }
    
    /**
     * 저장
     */
    async save() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        try {
            const result = await this.dataSyncManager.save(this.currentSchoolId);
            
            // result가 객체인 경우와 boolean인 경우 모두 처리
            if (result === true || (result && result.success === true)) {
                this.uiManager.showNotification('저장 완료', 'success');
            } else {
                const errorMsg = (result && result.message) ? result.message : '알 수 없는 오류';
                this.uiManager.showNotification('저장 실패: ' + errorMsg, 'error');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 중 오류 발생', 'error');
        }
    }
    
    /**
     * PPT 다운로드
     */
    async downloadPPT() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        if (!this.currentMode || !this.currentMode.startsWith('view-')) {
            alert('보기 모드에서만 PPT 다운로드가 가능합니다');
            return;
        }
        
        try {
            const mode = this.currentMode === 'view-equipment' ? 'equipment' : 'wireless-ap';
            
            // 장비보기 모드인 경우 장비 폰트 크기 전달
            let url = `/floorplan/export/ppt?schoolId=${this.currentSchoolId}&mode=${mode}`;
            if (mode === 'equipment' && this.core && this.core.equipmentFontSize) {
                // localStorage에서 해당 학교의 저장된 폰트 크기 확인
                const storageKey = `equipmentFontSize_${this.currentSchoolId}`;
                const savedFontSize = localStorage.getItem(storageKey);
                const fontSize = savedFontSize ? parseInt(savedFontSize) : this.core.equipmentFontSize;
                url += `&equipmentFontSize=${fontSize}`;
                console.log(`📤 PPT 다운로드: 장비 폰트 크기 ${fontSize}px 전달`);
            }
            
            window.location.href = url;
            
            this.uiManager.showNotification('PPT 다운로드 시작', 'success');
        } catch (error) {
            console.error('PPT 다운로드 오류:', error);
            this.uiManager.showNotification('다운로드 실패', 'error');
        }
    }
    
    // ===== 워크스페이스 관리 =====
    
    /**
     * 워크스페이스 열기
     */
    openWorkspace(type) {
        console.log('🖼️ 워크스페이스 열기:', type);
        
        const workspaceModal = document.getElementById('workspace-modal');
        if (!workspaceModal) {
            console.error('Workspace modal not found');
            return;
        }
        
        // 워크스페이스 표시
        workspaceModal.style.display = 'block';
        console.log('🖼️ 워크스페이스 모달 표시:', workspaceModal.style.display);
        
        // 캔버스가 표시된 후 리사이즈 및 중앙 뷰 설정
        // requestAnimationFrame을 사용하여 DOM이 완전히 렌더링된 후 실행
        const ensureCanvasVisible = () => {
            if (!this.core) {
                console.error('❌ Core가 초기화되지 않음');
                return;
            }
            
            // 캔버스 컨테이너 크기 확인
            const canvasContainer = document.querySelector('.workspace-canvas-container');
            if (!canvasContainer) {
                console.error('❌ 캔버스 컨테이너를 찾을 수 없음');
                return;
            }
            
            const rect = canvasContainer.getBoundingClientRect();
            console.log('🖼️ 캔버스 컨테이너 크기:', rect.width, 'x', rect.height);
            
            if (rect.width > 0 && rect.height > 0) {
                // 캔버스가 없으면 생성
                if (!this.core.canvas) {
                    console.log('🖼️ 캔버스가 없어서 생성 중...');
                    this.core.createCanvas();
                }
                
                this.core.resize();
                
                // 첫 진입 시에만 중앙 뷰로 설정, 이후에는 이전 상태 유지
                if (this.isFirstEntry) {
                    this.core.centerView();
                    localStorage.setItem('floorplan_has_entered', 'true');
                    console.log('✅ 캔버스 중앙 뷰 설정 (첫 진입)');
                } else {
                    // 이전 상태 유지 (줌/팬은 현재 상태 유지)
                    console.log('✅ 캔버스 뷰 상태 유지:', {
                        zoom: this.core.state.zoom,
                        panX: this.core.state.panX,
                        panY: this.core.state.panY
                    });
                }
                
                this.core.markDirty();
                this.core.render(); // 강제 렌더링
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
            } else {
                console.warn('⚠️ 캔버스 컨테이너 크기가 0, 재시도 예정...');
                // 크기가 0이면 다시 시도
                setTimeout(() => {
                    ensureCanvasVisible();
                }, 100);
            }
        };
        
        // DOM 렌더링 완료 대기
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ensureCanvasVisible();
            });
        });
        
        // 추가 안전장치: 500ms 후에도 한 번 더 시도
        setTimeout(() => {
            if (this.core && this.core.canvas) {
                const canvasContainer = document.querySelector('.workspace-canvas-container');
                if (canvasContainer) {
                    const rect = canvasContainer.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        this.core.resize();
                        
                        // 첫 진입 시에만 중앙 뷰로 설정, 이후에는 상태 유지
                        if (this.isFirstEntry) {
                            this.core.centerView();
                        }
                        
                        this.core.markDirty();
                        this.core.render();
                        this.updateZoomDisplay();
                        console.log('🖼️ 캔버스 최종 확인 및 렌더링');
                    }
                }
            }
        }, 500);
        
        // 모드 선택 드롭다운 필터링
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        if (workspaceModeSelect && type) {
            // 설계 모드면 설계 관련 옵션만, 보기 모드면 보기 관련 옵션만 보이도록
            Array.from(workspaceModeSelect.options).forEach(option => {
                if (!option.value) {
                    // 빈 옵션은 항상 표시
                    option.style.display = '';
                    return;
                }
                
                const isDesignOption = option.value.startsWith('design-');
                if (type === 'design' && !isDesignOption) {
                    option.style.display = 'none';
                } else if (type === 'view' && isDesignOption) {
                    option.style.display = 'none';
                } else {
                    option.style.display = '';
                }
            });
        }
        
        // 저장/설계 버튼 표시/숨김 설정 (초기에는 모두 숨김, 모드 선택 후 표시)
        const saveBtn = document.getElementById('workspace-save-btn');
        const designBtn = document.getElementById('workspace-design-btn');
        const pptBtn = document.getElementById('workspace-ppt-btn');
        
        if (saveBtn) {
            saveBtn.style.display = 'none'; // 초기에는 숨김
        }
        if (designBtn) {
            designBtn.style.display = 'none'; // 초기에는 숨김
        }
        if (pptBtn) {
            pptBtn.style.display = 'none'; // 초기에는 숨김, 모드 선택 후 표시
        }
        
        // 학교 목록 로드
        this.populateWorkspaceSchoolDropdown();
        
        // 초기 줌 디스플레이 업데이트
        this.updateZoomDisplay();
        
        this.uiManager.showNotification('작업 공간 열림', `${type === 'design' ? '설계' : '보기'} 모드로 작업 공간이 열렸습니다.`, 'info');
    }
    
    /**
     * 워크스페이스 닫기
     */
    closeWorkspace() {
        console.log('🚪 워크스페이스 닫기');
        
        // /floorplan으로 이동 (새로고침 효과)
        window.location.href = '/floorplan';
        
        // 아래 코드는 페이지 이동으로 실행되지 않지만 유지
        const workspaceModal = document.getElementById('workspace-modal');
        if (workspaceModal) {
            workspaceModal.style.display = 'none';
        }
        
        // 현재 모드 정리
        if (this.modeManager && this.modeManager.deactivate) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        // 도구창 숨김
        const toolbarContainer = document.getElementById('design-toolbar-container');
        if (toolbarContainer) {
            toolbarContainer.style.display = 'none';
        }
        
        // 상태 초기화
        this.currentMode = null;
        this.currentSchoolId = null;
        
        // Core 상태 초기화
        if (this.core) {
            this.core.currentSchoolId = null;
        }
        
        // 캔버스 요소 전체 삭제
        if (this.elementManager) {
            this.elementManager.clearAllElements();
        }
        
        // 캔버스 뷰 초기화
        if (this.core) {
            this.core.centerView();
            this.core.markDirty();
        }
        
        // 드롭다운 초기화
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        if (workspaceSchoolSelect) {
            workspaceSchoolSelect.value = '';
        }
        
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        if (workspaceModeSelect) {
            workspaceModeSelect.value = '';
        }
        
        this.uiManager.showNotification('작업 공간 닫힘', '변경 사항이 저장되지 않았을 수 있습니다.', 'warning');
    }
    
    /**
     * 워크스페이스 학교 드롭다운 채우기
     */
    populateWorkspaceSchoolDropdown() {
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        if (!workspaceSchoolSelect) return;
        
        // 기존 옵션 제거 (첫 번째 제외)
        while (workspaceSchoolSelect.options.length > 1) {
            workspaceSchoolSelect.remove(1);
        }
        
        // 학교 목록 추가
        this.schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.schoolId;
            option.textContent = school.schoolName;
            workspaceSchoolSelect.appendChild(option);
        });
    }
    
    /**
     * 워크스페이스 학교 변경
     */
    async onWorkspaceSchoolChange(schoolId) {
        if (!schoolId) return;
        
        console.log('🏫 워크스페이스 학교 변경:', schoolId);
        
        // 1. 이전 평면도 완전 초기화
        console.log('🧹 이전 평면도 초기화 시작');
        
        // 선택 상태 초기화 (InteractionManager)
        if (this.interactionManager && this.interactionManager.clearSelection) {
            this.interactionManager.clearSelection();
        }
        
        // 요소 모두 삭제
        this.elementManager.clearAllElements();
        this.core.setState({
            elements: [],
            selectedElements: [],
            hoveredElement: null
        });
        this.core.markDirty();
        
        // 2. 학교 ID 업데이트
        this.currentSchoolId = parseInt(schoolId);
        this.core.currentSchoolId = this.currentSchoolId;
        
        // 3. 현재 모드 저장 및 비활성화
        const currentMode = this.currentMode;
        if (this.modeManager && this.modeManager.deactivate) {
            console.log('🔄 모드 비활성화:', currentMode);
            this.modeManager.deactivate();
            this.modeManager = null; // 명시적으로 null 설정
        }
        this.currentMode = null; // 모드 상태 초기화
        
        // 4. 평면도 로드
        try {
            const success = await this.dataSyncManager.load(this.currentSchoolId);
            
            console.log('📥 평면도 로드 결과:', success ? '성공 (요소 있음)' : '실패 또는 빈 평면도');
            
            // 5. 모드 재활성화 (로드 후)
            if (currentMode) {
                console.log('🔄 모드 재활성화:', currentMode);
                await this.switchMode(currentMode);
                
                // 장비 보기 모드인 경우 해당 학교의 저장된 폰트 크기 불러오기
                if (currentMode === 'view-equipment') {
                    const equipmentFontSizeInput = document.getElementById('equipment-font-size-input');
                    if (equipmentFontSizeInput && this.core) {
                        const storageKey = `equipmentFontSize_${this.currentSchoolId}`;
                        const savedFontSize = localStorage.getItem(storageKey);
                        const fontSize = savedFontSize ? parseInt(savedFontSize) : 28;
                        
                        equipmentFontSizeInput.value = fontSize;
                        this.core.equipmentFontSize = fontSize;
                        console.log(`📖 학교 변경 후 장비 폰트 크기 불러오기 (학교 ${this.currentSchoolId}): ${fontSize}px`);
                        
                        // 장비 텍스트 재렌더링
                        if (this.modeManager && this.modeManager.renderEquipmentCards) {
                            this.modeManager.renderEquipmentCards();
                            this.core.markDirty();
                            this.core.render && this.core.render();
                        }
                    }
                }
            } else {
                console.warn('⚠️ 재활성화할 모드가 없음');
            }
            
            // 6. 뷰 조정
            if (success && this.core.state.elements && this.core.state.elements.length > 0) {
                console.log('📍 요소에 맞춰 뷰 조정:', this.core.state.elements.length, '개');
                this.core.fitToElements();
            } else {
                console.log('📍 기본 뷰 (빈 캔버스)');
                this.core.centerView();
            }
            
            this.core.markDirty();
            this.updateZoomDisplay();
            
        } catch (error) {
            console.error('❌ 평면도 로드 오류:', error);
            this.elementManager.clearAllElements();
            this.core.centerView();
            this.core.markDirty();
            this.updateZoomDisplay();
        }
    }
    
    /**
     * 워크스페이스 모드 변경
     */
    async onWorkspaceModeChange(mode) {
        if (!mode) return;
        
        console.log('🔄 워크스페이스 모드 변경:', mode);
        
        if (!this.currentSchoolId) {
            alert('먼저 학교를 선택해주세요.');
            document.getElementById('workspace-mode-select').value = '';
            return;
        }
        
        // 기존 모드 종료
        if (this.modeManager && this.modeManager.deactivate) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        // 교실 설계 모드에서 저장 후 다른 모드로 전환하는 경우 평면도 재로드
        // (교실 좌표가 업데이트되었을 수 있으므로)
        if (this.currentMode === 'design-classroom') {
            console.log('🔄 교실 설계 모드에서 전환 - 평면도 재로드');
            try {
                await this.dataSyncManager.load(this.currentSchoolId);
                console.log('✅ 평면도 재로드 완료');
            } catch (error) {
                console.error('❌ 평면도 재로드 오류:', error);
            }
        }
        
        // 보기 모드로 전환하는 경우 현재 페이지의 요소만 로드
        if (mode.startsWith('view-')) {
            console.log('🔄 보기 모드로 전환 - 현재 페이지 요소만 로드');
            try {
                // 현재 페이지의 로컬 요소를 먼저 저장
                if (this.core && this.core.state && this.core.state.elements) {
                    const currentPageLocalElements = this.core.state.elements.filter(el => {
                        if (!el || (!el.id && !el.elementType)) return false;
                        const elPage = el.pageNumber || this.currentPage;
                        return elPage === this.currentPage;
                    });
                    
                    if (currentPageLocalElements.length > 0) {
                        this.localElementsByPage[this.currentPage] = JSON.parse(JSON.stringify(currentPageLocalElements));
                        console.log(`💾 보기 모드 전환 전 페이지 ${this.currentPage}의 요소 ${currentPageLocalElements.length}개 저장`);
                    }
                }
                
                await this.loadPageElements(this.currentPage);
                
                // 서버에서 로드한 요소의 ID 목록
                const serverElementIds = new Set(
                    this.core.state.elements
                        .filter(el => el.id && !el.id.toString().startsWith('temp'))
                        .map(el => el.id.toString())
                );
                
                // 저장된 로컬 요소 복원
                if (this.localElementsByPage[this.currentPage]) {
                    const savedLocalElements = this.localElementsByPage[this.currentPage];
                    const restoredElements = JSON.parse(JSON.stringify(savedLocalElements));
                    
                    const localOnlyElements = restoredElements.filter(el => {
                        if (!el.id || el.id.toString().startsWith('temp')) {
                            return true;
                        }
                        return !serverElementIds.has(el.id.toString());
                    });
                    
                    if (localOnlyElements.length > 0) {
                        this.core.state.elements = [...this.core.state.elements, ...localOnlyElements];
                        console.log(`📂 보기 모드 전환 후 페이지 ${this.currentPage}의 로컬 요소 ${localOnlyElements.length}개 복원`);
                    }
                }
                
                // 현재 페이지의 요소만 필터링
                this.core.state.elements = this.core.state.elements.filter(el => 
                    el.pageNumber === this.currentPage || el.pageNumber === null || el.pageNumber === undefined
                );
                this.core.markDirty();
                this.core.render && this.core.render();
                console.log('✅ 현재 페이지 요소만 로드 완료');
            } catch (error) {
                console.error('❌ 페이지 요소 로드 오류:', error);
            }
        }
        
        // 새 모드 시작
        await this.switchMode(mode);
        
        // 모드 선택 드롭다운 필터링 업데이트
        this.updateModeSelectFilter(mode);
        
        // 저장/설계/보기 버튼 전환
        const saveBtn = document.getElementById('workspace-save-btn');
        const designBtn = document.getElementById('workspace-design-btn');
        const viewBtn = document.getElementById('workspace-view-btn');
        const toolbarContainer = document.getElementById('design-toolbar-container');
        const headerCollapseBtn = document.getElementById('header-collapse-btn');
        const isViewMode = mode.startsWith('view-');
        const isDesignMode = mode.startsWith('design-');
        const isSeatLayoutMode = mode === 'design-seat';
        const isWirelessApMode = mode === 'design-wireless';
        
        if (saveBtn) {
            // 자리배치설계모드에서는 저장 버튼 숨김
            saveBtn.style.display = (isViewMode || isSeatLayoutMode) ? 'none' : 'flex';
        }
        
        // 자리배치설계모드에서는 도구창 숨김
        if (toolbarContainer) {
            toolbarContainer.style.display = (mode.startsWith('design-') && !isSeatLayoutMode) ? 'block' : 'none';
        }
        
        // 무선AP설계모드와 자리배치설계모드에서는 토글 버튼 숨김
        if (headerCollapseBtn) {
            headerCollapseBtn.style.display = (isSeatLayoutMode || isWirelessApMode) ? 'none' : 'block';
        }
        if (designBtn) {
            designBtn.style.display = isViewMode ? 'flex' : 'none';
            
            // 설계 버튼 텍스트 변경
            const designBtnText = designBtn.querySelector('span');
            if (designBtnText) {
                if (mode === 'view-equipment') {
                    designBtnText.textContent = '교실 설계';
                } else if (mode === 'view-wireless') {
                    designBtnText.textContent = '무선AP 설계';
                }
            }
        }
        if (viewBtn) {
            viewBtn.style.display = isDesignMode ? 'flex' : 'none';
            
            // 보기 버튼 텍스트 변경
            const viewBtnText = viewBtn.querySelector('span');
            if (viewBtnText) {
                if (mode === 'design-classroom') {
                    viewBtnText.textContent = '장비 보기';
                } else if (mode === 'design-wireless') {
                    viewBtnText.textContent = '무선AP 보기';
                } else {
                    viewBtnText.textContent = '보기';
                }
            }
        }
        
        // PPT 버튼 표시 여부
        const pptBtn = document.getElementById('workspace-ppt-btn');
        if (pptBtn) {
            pptBtn.style.display = isViewMode ? 'flex' : 'none';
        }
        
        // 장비 폰트 크기 조절 UI 표시 여부 (장비 보기 모드에서만)
        const equipmentFontControl = document.getElementById('equipment-font-size-control');
        const equipmentFontSizeInput = document.getElementById('equipment-font-size-input');
        if (equipmentFontControl) {
            equipmentFontControl.style.display = (mode === 'view-equipment') ? 'flex' : 'none';
        }
        // 장비 보기 모드로 전환 시 해당 학교의 저장된 폰트 크기 불러오기
        if (mode === 'view-equipment' && equipmentFontSizeInput && this.core && this.currentSchoolId) {
            const storageKey = `equipmentFontSize_${this.currentSchoolId}`;
            const savedFontSize = localStorage.getItem(storageKey);
            const fontSize = savedFontSize ? parseInt(savedFontSize) : 28; // 저장된 값이 있으면 사용, 없으면 기본값 28
            
            // 입력 필드와 Core에 폰트 크기 설정
            equipmentFontSizeInput.value = fontSize;
            this.core.equipmentFontSize = fontSize;
            console.log(`📖 장비 폰트 크기 불러오기 (학교 ${this.currentSchoolId}): ${fontSize}px`);
        }
        
        // 강제 렌더링
        if (this.core) {
            this.core.markDirty();
        }
    }
    
    /**
     * 모드 선택 드롭다운 필터링 업데이트
     */
    updateModeSelectFilter(mode) {
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        if (!workspaceModeSelect) return;
        
        // 모드 타입 결정 (design 또는 view)
        const modeType = mode.startsWith('design-') ? 'design' : 'view';
        
        // 모든 옵션 표시/숨김 처리
        Array.from(workspaceModeSelect.options).forEach(option => {
            if (!option.value) {
                // 빈 옵션은 항상 표시
                option.style.display = '';
                return;
            }
            
            const isDesignOption = option.value.startsWith('design-');
            if (modeType === 'design' && !isDesignOption) {
                // 설계 모드로 전환했는데 보기 옵션이면 숨김
                option.style.display = 'none';
            } else if (modeType === 'view' && isDesignOption) {
                // 보기 모드로 전환했는데 설계 옵션이면 숨김
                option.style.display = 'none';
            } else {
                // 같은 타입이면 표시
                option.style.display = '';
            }
        });
        
        console.log('🔄 모드 선택 드롭다운 필터링 업데이트:', modeType);
    }
    
    /**
     * 보기 모드에서 해당 설계 모드로 전환
     */
    async switchToDesignMode() {
        const currentMode = this.currentMode;
        let targetMode = null;
        
        // 현재 보기 모드에 따라 해당 설계 모드로 전환
        if (currentMode === 'view-equipment') {
            targetMode = 'design-classroom';
        } else if (currentMode === 'view-wireless') {
            targetMode = 'design-wireless';
        }
        
        if (targetMode) {
            console.log(`🔀 설계 모드로 전환: ${currentMode} → ${targetMode}`);
            
            // 모드 선택 UI 업데이트
            const modeSelect = document.getElementById('workspace-mode-select');
            if (modeSelect) {
                modeSelect.value = targetMode;
            }
            
            // 모드 전환
            await this.onWorkspaceModeChange(targetMode);
        }
    }
    
    /**
     * 설계 모드에서 해당 보기 모드로 전환
     */
    async switchToViewMode() {
        const currentMode = this.currentMode;
        let targetMode = null;
        
        // 현재 설계 모드에 따라 해당 보기 모드로 전환
        if (this.modeManager && typeof this.modeManager.getViewModeForButton === 'function') {
            targetMode = this.modeManager.getViewModeForButton();
        } else if (currentMode === 'design-wireless') {
            targetMode = 'view-wireless';
        }
        
        if (targetMode) {
            console.log(`🔀 보기 모드로 전환: ${currentMode} → ${targetMode}`);
            
            // 모드 선택 UI 업데이트
            const modeSelect = document.getElementById('workspace-mode-select');
            if (modeSelect) {
                modeSelect.value = targetMode;
            }
            
            // 모드 전환
            await this.onWorkspaceModeChange(targetMode);
        }
    }
    
    /**
     * 현재 작업 저장
     */
    async saveCurrentWork() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        try {
            // 1. 삭제 예정인 페이지들 먼저 삭제
            if (this.deletedPages.length > 0) {
                for (const pageNumber of this.deletedPages) {
                    try {
                        const response = await fetch(`/floorplan/api/elements/delete-page?schoolId=${this.currentSchoolId}&pageNumber=${pageNumber}`, {
                            method: 'DELETE'
                        });
                        
                        if (!response.ok) {
                            console.error(`페이지 ${pageNumber} 삭제 실패`);
                        } else {
                            console.log(`✅ 페이지 ${pageNumber} 삭제 완료`);
                        }
                    } catch (error) {
                        console.error(`페이지 ${pageNumber} 삭제 오류:`, error);
                    }
                }
                // 삭제 완료 후 목록 초기화
                this.deletedPages = [];
            }
            
            // 2. 현재 페이지의 요소들에 페이지 번호 설정 및 메모리에 저장
            const currentPageElements = this.core.state.elements;
            for (const element of currentPageElements) {
                if (element.id || element.elementType) {
                    element.pageNumber = this.currentPage;
                }
            }
            // 현재 페이지의 요소를 localElementsByPage에 저장 (빈 배열이어도 저장하여 삭제 상태 반영)
            this.localElementsByPage[this.currentPage] = JSON.parse(JSON.stringify(currentPageElements));
            
            // 3. 서버에서 모든 페이지의 요소들 로드
            const allPageElements = await this.loadAllPageElements();
            
            // 4. 서버 요소의 ID 목록 생성 (중복 제거용)
            const serverElementIds = new Set(
                allPageElements
                    .filter(el => el.id && !el.id.toString().startsWith('temp'))
                    .map(el => el.id.toString())
            );
            
            // 5. 모든 페이지의 로컬 요소들을 수집 (localElementsByPage에서)
            // 다른 페이지의 로컬 요소는 서버 요소와 병합하여 유지
            const allLocalElements = [];
            for (const pageNum in this.localElementsByPage) {
                const pageNumInt = parseInt(pageNum);
                const pageLocalElements = this.localElementsByPage[pageNumInt];
                
                // 현재 페이지는 currentPageElements로 교체되므로 제외
                if (pageNumInt === this.currentPage) {
                    continue;
                }
                
                if (pageLocalElements && pageLocalElements.length > 0) {
                    // 페이지 번호 설정
                    const elementsWithPage = pageLocalElements.map(el => {
                        const element = JSON.parse(JSON.stringify(el));
                        element.pageNumber = pageNumInt;
                        return element;
                    });
                    allLocalElements.push(...elementsWithPage);
                }
            }
            
            // 6. 서버 요소와 로컬 요소를 병합
            // 서버 요소 중 현재 페이지에 속한 요소는 제외 (현재 페이지 요소로 교체)
            // 다른 페이지의 요소는 그대로 유지
            const otherPageElements = allPageElements.filter(el => {
                const elPage = el.pageNumber || 1;
                return elPage !== this.currentPage;
            });
            
            // 다른 페이지의 로컬 요소 중 서버에 없는 것만 추가 (로컬에서 추가/수정한 요소)
            const otherPageLocalElements = allLocalElements.filter(el => {
                if (!el.id || el.id.toString().startsWith('temp')) {
                    return true; // 새로 추가한 요소
                }
                return !serverElementIds.has(el.id.toString()); // 수정된 요소
            });
            
            // 현재 페이지의 로컬 요소 중 서버에 없는 것만 추가 (로컬에서 추가/수정한 요소)
            const currentPageLocalElements = currentPageElements.filter(el => {
                if (!el.id || el.id.toString().startsWith('temp')) {
                    return true; // 새로 추가한 요소
                }
                return !serverElementIds.has(el.id.toString()); // 수정된 요소
            });
            
            // 모든 요소 병합: 다른 페이지 요소 + 다른 페이지 로컬 요소 + 현재 페이지 요소
            // currentPageElements가 빈 배열이어도 포함하여 삭제 상태를 반영
            const mergedElements = [
                ...otherPageElements, 
                ...otherPageLocalElements, 
                ...currentPageElements
            ];
            
            // 5. 임시로 core.state.elements를 모든 페이지 요소로 설정
            const originalElements = this.core.state.elements;
            this.core.state.elements = mergedElements;
            
            // 6. 교실 좌표 저장 (교실 설계 모드인 경우)
            let classroomSaveFailed = false;
            if (this.currentMode === 'design-classroom' && this.modeManager) {
                const classroomSaveResult = await this.saveClassroomCoordinates();
                if (classroomSaveResult === false) {
                    classroomSaveFailed = true;
                }
            }
            
            // 7. 평면도 데이터 저장 (알림은 여기서 통합 표시)
            const result = await this.dataSyncManager.save(this.currentSchoolId, false); // 내부 알림 비활성화
            
            // 8. core.state.elements를 원래대로 복원 (현재 페이지 요소만)
            this.core.state.elements = originalElements;
            
            console.log('💾 평면도 저장 결과:', result);
            
            // result가 객체인 경우와 boolean인 경우 모두 처리
            if (result === true || (result && result.success === true)) {
                // 저장 성공 후 로컬 요소 저장소 초기화 (모든 요소가 서버에 저장되었으므로)
                this.localElementsByPage = {};
                console.log('🔄 저장 완료 후 로컬 요소 저장소 초기화');
                
                // 5. 저장 후 빈 페이지 제거 및 maxPage 업데이트
                await this.cleanupEmptyPages();
                
                if (classroomSaveFailed) {
                    this.uiManager.showNotification('저장 완료 (일부 교실 저장 실패)', 'warning');
                } else {
                    this.uiManager.showNotification('저장 완료', 'success');
                }
            } else {
                // result가 false이거나 success가 false인 경우
                const errorMsg = (result && result.message) ? result.message : '알 수 없는 오류';
                this.uiManager.showNotification('저장 실패: ' + errorMsg, 'error');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 중 오류 발생', 'error');
        }
    }
    
    /**
     * 교실 좌표 저장
     * @returns {Boolean} 모든 교실 저장 성공 여부
     */
    async saveClassroomCoordinates() {
        const elements = this.core.state.elements;
        const roomElements = elements.filter(el => el.elementType === 'room' && el.classroomId);
        
        if (roomElements.length === 0) {
            console.log('💾 저장할 교실 좌표 없음');
            return true; // 저장할 교실이 없으면 성공으로 간주
        }
        
        console.log('💾 교실 좌표 저장 시작:', roomElements.length, '개');
        
        const savePromises = roomElements.map(async (room) => {
            try {
                const requestData = {
                    xCoordinate: Math.round(room.xCoordinate),
                    yCoordinate: Math.round(room.yCoordinate),
                    width: Math.round(room.width),
                    height: Math.round(room.height)
                };
                
                const response = await fetch(`/floorplan/api/classrooms/${room.classroomId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    const responseData = await response.json();
                    console.error(`❌ 교실 좌표 저장 실패 - ${room.label} (ID: ${room.classroomId})`, responseData);
                    return false;
                }
                
                console.log(`✅ 교실 좌표 저장: ${room.label}`);
                return true;
            } catch (error) {
                console.error(`❌ 교실 좌표 저장 오류 - ${room.label} (ID: ${room.classroomId}):`, error);
                return false;
            }
        });
        
        const results = await Promise.all(savePromises);
        const successCount = results.filter(r => r).length;
        
        console.log(`💾 교실 좌표 저장 완료: ${successCount}/${roomElements.length}`);
        
        // 알림은 saveCurrentWork에서 통합 표시하므로 여기서는 반환만
        return successCount === roomElements.length;
    }
    
    /**
     * 페이지 네비게이션 UI 생성
     */
    createPageNavigationUI() {
        // 기존 페이지 UI가 있으면 제거
        const existingPageUI = document.getElementById('page-navigation-ui');
        if (existingPageUI) {
            existingPageUI.remove();
        }
        
        // 페이지 네비게이션 컨테이너 생성
        const pageNav = document.createElement('div');
        pageNav.id = 'page-navigation-ui';
        pageNav.style.cssText = `
            position: fixed;
            top: 120px;
            right: 20px;
            z-index: 10000;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 6px 10px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        `;
        
        // 이전 페이지 버튼
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.style.cssText = `
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 3px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            padding: 0;
        `;
        prevBtn.addEventListener('click', () => this.switchPage(this.currentPage - 1));
        prevBtn.title = '이전 페이지';
        
        // 페이지 정보 표시
        const pageInfo = document.createElement('span');
        pageInfo.id = 'page-info-display';
        pageInfo.style.cssText = `
            min-width: 60px;
            text-align: center;
            font-weight: 500;
            font-size: 12px;
        `;
        pageInfo.textContent = `페이지 1 / 1`;
        
        // 다음 페이지 버튼
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.style.cssText = `
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 3px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            padding: 0;
        `;
        nextBtn.addEventListener('click', () => this.switchPage(this.currentPage + 1));
        nextBtn.title = '다음 페이지';
        
        // 버튼들을 컨테이너에 추가
        pageNav.appendChild(prevBtn);
        pageNav.appendChild(pageInfo);
        pageNav.appendChild(nextBtn);
        
        // 캔버스 컨테이너에 추가
        const canvasContainer = document.getElementById('workspace-canvas-wrapper') || 
                                document.getElementById('canvas') || 
                                document.body;
        canvasContainer.appendChild(pageNav);
        
        // 초기 페이지 정보 업데이트
        this.updatePageDisplay();
    }
    
    /**
     * 페이지 표시 정보 업데이트
     */
    updatePageDisplay() {
        const pageInfo = document.getElementById('page-info-display');
        if (pageInfo) {
            pageInfo.textContent = `페이지 ${this.currentPage} / ${this.maxPage}`;
        }
        
        // 버튼 활성화/비활성화
        const prevBtn = document.querySelector('#page-navigation-ui button:first-child');
        const nextBtn = document.querySelector('#page-navigation-ui button:last-child');
        
        if (prevBtn) {
            // 이전 페이지 버튼: 첫 페이지일 때만 비활성화
            prevBtn.disabled = this.currentPage <= 1;
            prevBtn.style.opacity = this.currentPage <= 1 ? '0.5' : '1';
            prevBtn.style.cursor = this.currentPage <= 1 ? 'not-allowed' : 'pointer';
        }
        
        if (nextBtn) {
            // 다음 페이지 버튼: 항상 활성화 (자동 페이지 생성)
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
        }
    }
    
    /**
     * 페이지 전환
     */
    async switchPage(pageNumber) {
        // 페이지 번호가 1보다 작으면 1로 고정
        if (pageNumber < 1) {
            pageNumber = 1;
        }
        
        // 현재 페이지의 모든 요소를 메모리에 저장 (서버에 저장되지 않은 모든 요소)
        if (this.core && this.core.state && this.core.state.elements) {
            // 현재 페이지의 모든 요소 저장 (나중에 서버 요소와 비교하여 로컬 요소만 유지)
            const currentPageElements = this.core.state.elements.filter(el => {
                if (!el || (!el.id && !el.elementType)) return false;
                const elPage = el.pageNumber || this.currentPage;
                return elPage === this.currentPage;
            });
            
            // 빈 배열이어도 저장 (삭제 상태 반영)
            this.localElementsByPage[this.currentPage] = JSON.parse(JSON.stringify(currentPageElements));
            console.log(`💾 페이지 ${this.currentPage}의 요소 ${currentPageElements.length}개 저장 (로컬)`);
        }
        
        // 다음 페이지로 넘기면 자동으로 페이지 생성
        if (pageNumber > this.maxPage) {
            this.maxPage = pageNumber;
        }
        
        // 페이지 변경 (저장은 나중에 저장 버튼을 눌렀을 때)
        this.currentPage = pageNumber;
        
        // Core에 현재 페이지 정보 업데이트
        if (this.core) {
            this.core.currentPage = pageNumber;
        }
        
        // 해당 페이지의 요소들만 필터링하여 표시
        await this.loadPageElements(pageNumber);
        
        // 서버에서 로드한 요소의 ID와 좌표 정보를 Map으로 저장 (중복 체크 강화)
        const serverElementMap = new Map();
        const serverElementIdSet = new Set();
        this.core.state.elements.forEach(el => {
            if (el.id && !el.id.toString().startsWith('temp')) {
                const elementId = el.id.toString();
                const key = `${elementId}_${el.xCoordinate}_${el.yCoordinate}`;
                serverElementIdSet.add(elementId);
                serverElementMap.set(key, el);
            }
        });
        
        // 저장된 로컬 요소 복원 (있는 경우)
        // 저장 후에는 localElementsByPage가 초기화되므로, 저장되지 않은 작업만 복원
        if (this.localElementsByPage[pageNumber] && this.localElementsByPage[pageNumber].length > 0) {
            const savedLocalElements = this.localElementsByPage[pageNumber];
            // 깊은 복사로 복원
            const restoredElements = JSON.parse(JSON.stringify(savedLocalElements));
            
            // 서버에 없는 요소만 복원 (로컬에서 추가/수정한 요소)
            // 중복 체크 강화: ID와 좌표를 모두 확인
            const localOnlyElements = restoredElements.filter(el => {
                // id가 없거나 temp로 시작하면 새로 추가한 로컬 요소
                if (!el.id || el.id.toString().startsWith('temp')) {
                    return true;
                }
                
                const elementId = el.id.toString();
                // id가 있으면 서버에 없는지 확인
                if (serverElementIdSet.has(elementId)) {
                    // ID가 서버에 있으면 좌표도 확인 (같은 요소인지 체크)
                    const key = `${elementId}_${el.xCoordinate}_${el.yCoordinate}`;
                    if (serverElementMap.has(key)) {
                        // 서버에 동일한 요소가 있으면 제외 (중복)
                        return false;
                    }
                }
                
                // 서버에 없는 요소만 포함
                return true;
            });
            
            if (localOnlyElements.length > 0) {
                // 서버에서 로드한 요소와 병합 (로컬 요소는 뒤에 추가)
                this.core.state.elements = [...this.core.state.elements, ...localOnlyElements];
                console.log(`📂 페이지 ${pageNumber}의 로컬 요소 ${localOnlyElements.length}개 복원`);
            } else {
                console.log(`📂 페이지 ${pageNumber}의 로컬 요소 없음 (모두 서버에 저장됨)`);
            }
        }
        
        // 현재 페이지의 요소만 필터링 (pageNumber 확인)
        // 중복 방지: 같은 ID의 요소가 여러 개 있으면 하나만 유지
        const seenElementIds = new Set();
        this.core.state.elements = this.core.state.elements.filter(el => {
            if (!el || (!el.id && !el.elementType)) return false;
            
            const elPage = el.pageNumber || pageNumber;
            const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
            
            // 현재 페이지와 일치하는 요소만 포함
            if (normalizedPage === pageNumber) {
                // 중복 체크: 같은 ID의 요소가 이미 포함되었는지 확인
                const elementId = el.id ? el.id.toString() : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                if (seenElementIds.has(elementId)) {
                    console.warn(`⚠️ 중복 요소 제거 (switchPage): ${elementId}`);
                    return false;
                }
                seenElementIds.add(elementId);
                return true;
            }
            return false;
        });
        
        // 페이지 정보 업데이트
        this.updatePageDisplay();
        
        // 캔버스 재렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
        
        // 모드별 추가 처리
        if (this.modeManager && typeof this.modeManager.onPageSwitch === 'function') {
            this.modeManager.onPageSwitch(pageNumber);
        }
        
        console.log(`📄 페이지 전환: ${pageNumber} (최대: ${this.maxPage})`);
    }
    
    /**
     * 현재 페이지의 요소들 저장 (더 이상 사용하지 않음 - saveCurrentWork에서 처리)
     */
    async saveCurrentPageElements() {
        // 이 메서드는 더 이상 사용하지 않음
        // 페이지 번호는 saveCurrentWork에서 저장 시 설정됨
        return;
    }
    
    /**
     * 빈 페이지 정리 (요소가 없는 페이지 제거)
     */
    async cleanupEmptyPages() {
        if (!this.currentSchoolId) {
            return;
        }
        
        try {
            // 서버에서 모든 페이지의 요소 개수 확인
            const pagesWithElements = new Set();
            let maxPageWithElements = 0;
            
            // 1부터 maxPage까지 각 페이지의 요소 확인
            for (let pageNum = 1; pageNum <= this.maxPage; pageNum++) {
                try {
                    const response = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=${pageNum}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.elements && data.elements.length > 0) {
                            pagesWithElements.add(pageNum);
                            maxPageWithElements = Math.max(maxPageWithElements, pageNum);
                        } else {
                            // 빈 페이지: 서버에서 삭제
                            console.log(`🗑️ 빈 페이지 ${pageNum} 삭제`);
                            const deleteResponse = await fetch(`/floorplan/api/elements/delete-page?schoolId=${this.currentSchoolId}&pageNumber=${pageNum}`, {
                                method: 'DELETE'
                            });
                            if (deleteResponse.ok) {
                                console.log(`✅ 빈 페이지 ${pageNum} 삭제 완료`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`페이지 ${pageNum} 확인 오류:`, error);
                }
            }
            
            // maxPage 업데이트 (실제 요소가 있는 최대 페이지 번호)
            const newMaxPage = maxPageWithElements > 0 ? maxPageWithElements : 1;
            
            // 현재 페이지가 삭제된 경우, 마지막 요소가 있는 페이지로 이동
            if (this.currentPage > newMaxPage) {
                this.currentPage = newMaxPage;
                // Core에 현재 페이지 정보 업데이트
                if (this.core) {
                    this.core.currentPage = this.currentPage;
                }
                // 해당 페이지의 요소들 로드
                await this.loadPageElements(this.currentPage);
            }
            
            // maxPage 업데이트
            this.maxPage = newMaxPage;
            
            // 페이지 정보 업데이트
            this.updatePageDisplay();
            
            console.log(`🧹 빈 페이지 정리 완료: maxPage = ${this.maxPage}`);
        } catch (error) {
            console.error('빈 페이지 정리 오류:', error);
        }
    }
    
    /**
     * 모든 페이지의 요소들 로드
     */
    async loadAllPageElements() {
        if (!this.currentSchoolId) {
            return [];
        }
        
        try {
            const allElements = [];
            
            // 1부터 maxPage까지 모든 페이지의 요소들 로드
            for (let pageNum = 1; pageNum <= this.maxPage; pageNum++) {
                try {
                    const response = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=${pageNum}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.elements) {
                            // 백엔드 엔티티를 프론트엔드 형식으로 변환
                            const elements = data.elements.map(el => {
                                const element = {
                                    id: el.id,
                                    elementType: el.elementType,
                                    xCoordinate: el.xCoordinate,
                                    yCoordinate: el.yCoordinate,
                                    width: el.width,
                                    height: el.height,
                                    zIndex: el.zIndex,
                                    pageNumber: el.pageNumber || pageNum,
                                    label: el.label,
                                    // elementData 파싱
                                    ...(el.elementData ? JSON.parse(el.elementData) : {})
                                };
                                return element;
                            });
                            allElements.push(...elements);
                        }
                    }
                } catch (error) {
                    console.error(`페이지 ${pageNum} 요소 로드 오류:`, error);
                }
            }
            
            console.log(`📥 모든 페이지 요소 로드 완료: ${allElements.length}개`);
            return allElements;
        } catch (error) {
            console.error('모든 페이지 요소 로드 오류:', error);
            return [];
        }
    }
    
    /**
     * 페이지 요소 로드
     */
    async loadPageElements(pageNumber) {
        if (!this.currentSchoolId) {
            return { success: false };
        }
        
        try {
            // 서버에서 해당 페이지의 요소들만 로드
            const response = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=${pageNumber}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.elements) {
                    // 요소들을 Core에 로드 (프론트엔드 형식으로 변환)
                    const elements = data.elements.map(el => {
                        // 백엔드 엔티티를 프론트엔드 형식으로 변환
                        const element = {
                            id: el.id,
                            elementType: el.elementType,
                            xCoordinate: el.xCoordinate,
                            yCoordinate: el.yCoordinate,
                            width: el.width,
                            height: el.height,
                            zIndex: el.zIndex,
                            pageNumber: el.pageNumber || pageNumber,
                            label: el.label,
                            // elementData 파싱
                            ...(el.elementData ? JSON.parse(el.elementData) : {})
                        };
                        return element;
                    });
                    
                    this.core.state.elements = elements;
                    
                    // 최대 페이지 번호 업데이트 (서버에서 받은 값으로 설정)
                    const maxPage = data.maxPage || 1;
                    
                    this.core.markDirty();
                    this.core.render && this.core.render();
                    
                    return { success: true, maxPage: maxPage };
                }
            }
            return { success: false };
        } catch (error) {
            console.error('페이지 요소 로드 오류:', error);
            // 오류 시 빈 배열로 초기화
            this.core.state.elements = [];
            this.core.markDirty();
            this.core.render && this.core.render();
            return { success: false };
        }
    }
    
    /**
     * 새 페이지 추가
     */
    async addNewPage() {
        // 새 페이지로 전환 (저장은 나중에 저장 버튼을 눌렀을 때)
        this.maxPage++;
        this.currentPage = this.maxPage;
        
        // 빈 캔버스 표시
        this.core.state.elements = [];
        this.core.markDirty();
        this.core.render && this.core.render();
        
        // 페이지 정보 업데이트
        this.updatePageDisplay();
        
        console.log(`➕ 새 페이지 추가: ${this.currentPage} (저장 필요)`);
    }
    
    /**
     * 현재 페이지 삭제
     */
    async deleteCurrentPage() {
        // 페이지가 1개만 있으면 삭제 불가
        if (this.maxPage <= 1) {
            alert('최소 1개의 페이지가 필요합니다.');
            return;
        }
        
        // 마지막 페이지가 아니면 삭제 불가 (현재는 마지막 페이지만 삭제 가능)
        if (this.currentPage !== this.maxPage) {
            alert('마지막 페이지만 삭제할 수 있습니다.');
            return;
        }
        
        // 확인 메시지
        if (!confirm(`페이지 ${this.currentPage}를 삭제하시겠습니까? (저장 버튼을 눌러야 실제로 삭제됩니다)`)) {
            return;
        }
        
        // 삭제 예정 목록에 추가 (저장 시 실제 삭제)
        this.deletedPages.push(this.currentPage);
        
        // 최대 페이지 번호 감소
        this.maxPage--;
        
        // 마지막 페이지로 전환
        this.currentPage = this.maxPage;
        
        // 해당 페이지의 요소들 로드
        await this.loadPageElements(this.currentPage);
        
        // 페이지 정보 업데이트
        this.updatePageDisplay();
        
        console.log(`🗑️ 페이지 삭제 예정: ${this.deletedPages[this.deletedPages.length - 1]} (저장 필요)`);
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.floorPlanApp = new FloorPlanApp();
    window.floorPlanApp.init();
});

export default FloorPlanApp;

