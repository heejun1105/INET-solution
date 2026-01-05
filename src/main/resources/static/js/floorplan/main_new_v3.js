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
        
        // AP 변경 사항 보존 (모드 전환 시에도 유지)
        this.savedApPositions = {};
        
        // 저장되지 않은 변경사항 추적 (설계 모드에서만)
        this.lastSavedStateByPage = {}; // 페이지별 마지막 저장 상태 (요소 개수, 해시 등)
        this.initialApPositionsByPage = {}; // 페이지별 초기 AP 위치 상태 (무선AP 설계 모드용)
        
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
            // 단, fitToElements에서 A4 중앙으로 이동한 직후인 경우 범위 제한을 무시
            if (typeof this.core.setPan === 'function' && !this.core._skipPanClamp) {
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
            
            // 먼저 서버에서 maxPage 정보를 가져옴 (요소 로드 전에 설정하여 페이지 정보가 올바르게 표시되도록)
            let maxPageFromServer = null;
            try {
                const maxPageResponse = await fetch(`/floorplan/api/elements?schoolId=${schoolId}&pageNumber=1`);
                if (maxPageResponse.ok) {
                    const maxPageData = await maxPageResponse.json();
                    console.log(`📄 서버 응답 데이터 (loadFloorPlan 초기):`, JSON.stringify(maxPageData, null, 2));
                    if (maxPageData.success) {
                        // maxPage를 숫자로 명시적 변환 (문자열로 올 수 있음)
                        // null, undefined, 빈 문자열 등도 처리
                        const maxPageRaw = maxPageData.maxPage;
                        if (maxPageRaw !== null && maxPageRaw !== undefined && maxPageRaw !== '') {
                            const maxPageValue = parseInt(maxPageRaw, 10);
                            if (!isNaN(maxPageValue) && maxPageValue > 0) {
                                maxPageFromServer = maxPageValue;
                                console.log(`📄 서버에서 최대 페이지 번호 조회: ${maxPageFromServer} (원본: ${maxPageRaw}, 타입: ${typeof maxPageRaw})`);
                            } else {
                                console.warn(`⚠️ 서버에서 maxPage를 제공하지 않음 또는 유효하지 않음: ${maxPageRaw} (타입: ${typeof maxPageRaw}, 파싱 결과: ${maxPageValue})`);
                            }
                        } else {
                            console.warn(`⚠️ 서버에서 maxPage가 null/undefined/빈 문자열: ${maxPageRaw}`);
                        }
                    } else {
                        console.warn(`⚠️ 서버 응답이 실패: ${maxPageData.message || '알 수 없는 오류'}`);
                    }
                } else {
                    console.warn(`⚠️ 서버 응답 오류: ${maxPageResponse.status} ${maxPageResponse.statusText}`);
                }
            } catch (error) {
                console.warn('최대 페이지 번호 조회 실패, 요소 로드 시 받아올 예정:', error);
            }
            
            // maxPage를 먼저 설정 (요소 로드 전에 설정하여 페이지 정보가 올바르게 표시되도록)
            // maxPageFromServer가 null이면 1로 설정하되, loadPageElements에서 업데이트될 예정
            this.maxPage = maxPageFromServer || 1;
            console.log(`📄 최대 페이지 번호 설정 (초기): ${this.maxPage} (서버 값: ${maxPageFromServer})`);
            
            // 초기 maxPage 설정 후 즉시 페이지 정보 업데이트
            this.updatePageDisplay();
            
            // 현재 페이지의 요소들만 로드
            const result = await this.loadPageElements(this.currentPage);
            
            if (result && result.success) {
                console.log('✅ 평면도 로드 완료');
                
                // result.maxPage가 있으면 우선 사용 (더 정확한 값, 요소 로드 결과)
                const resultMaxPageValue = parseInt(result.maxPage, 10);
                if (!isNaN(resultMaxPageValue) && resultMaxPageValue > 0) {
                    this.maxPage = resultMaxPageValue;
                    console.log(`📄 최대 페이지 번호 업데이트 (요소 로드 결과): ${this.maxPage} (원본: ${result.maxPage}, 타입: ${typeof result.maxPage})`);
                }
                
                // maxPage 설정 후 페이지 정보 즉시 업데이트
                this.updatePageDisplay();
                console.log(`📄 페이지 정보 업데이트: ${this.currentPage} / ${this.maxPage}`);
                
                // loadPageElements에서 이미 필터링되었지만, 추가 중복 제거 및 페이지 필터링
                // pageNumber가 null/undefined인 요소와 pageNumber === 1인 요소가 중복되지 않도록 처리
                const seenElementKeys = new Set(); // ID + 좌표
                const seenElementCoords = new Set(); // 타입 + 좌표 (임시 ID와 실제 ID가 다른 경우 대비)
                this.core.state.elements = this.core.state.elements.filter(el => {
                    if (!el || (!el.id && !el.elementType)) return false;
                    
                    // 중복 체크: ID와 좌표를 모두 확인하여 완전히 동일한 요소 제거
                    const elementKey = el.id 
                        ? `${el.id}_${el.xCoordinate}_${el.yCoordinate}` 
                        : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                    
                    // 좌표 기반 중복 체크 (임시 ID와 실제 ID가 다른 경우 대비)
                    const coordKey = `${el.elementType || 'unknown'}_${el.xCoordinate}_${el.yCoordinate}`;
                    
                    if (seenElementKeys.has(elementKey)) {
                        console.warn(`⚠️ 중복 요소 제거 (loadFloorPlan - ID+좌표): ${elementKey}`);
                        return false;
                    }
                    
                    if (seenElementCoords.has(coordKey)) {
                        console.warn(`⚠️ 중복 요소 제거 (loadFloorPlan - 좌표): ${coordKey}`);
                        return false;
                    }
                    
                    seenElementKeys.add(elementKey);
                    seenElementCoords.add(coordKey);
                    
                    const elPage = el.pageNumber;
                    // pageNumber가 null/undefined이면 1페이지로 간주
                    const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
                    
                    // 현재 페이지와 일치하는 것만 포함
                    if (normalizedPage === this.currentPage) {
                        seenElementKeys.add(elementKey);
                        return true;
                    }
                    return false;
                });
                
                console.log(`📄 필터링 후 현재 페이지 ${this.currentPage}의 요소: ${this.core.state.elements.length}개`);
                
                // 모드가 선택되지 않았을 때 (학교만 선택) AP/MDF 요소 제거
                // AP/MDF는 무선AP 설계 모드에서만 표시되어야 함
                if (!this.currentMode || this.currentMode === '') {
                    const beforeCount = this.core.state.elements.length;
                    this.core.state.elements = this.core.state.elements.filter(el => {
                        if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                            return false;
                        }
                        return true;
                    });
                    const removedCount = beforeCount - this.core.state.elements.length;
                    if (removedCount > 0) {
                        console.log(`🗑️ 모드 미선택 상태: AP/MDF 요소 ${removedCount}개 제거`);
                    }
                }
                
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
                
                // 무선AP 설계 모드인 경우 초기 AP 위치 상태는 activate() 내부에서 저장됨
                // (renderWirelessAps 완료 후 저장하도록 변경)
                
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
    /**
     * 저장되지 않은 변경사항이 있는지 확인
     * @param {Number} pageNumber - 확인할 페이지 번호 (없으면 현재 페이지)
     * @returns {Boolean} 저장되지 않은 변경사항이 있으면 true
     */
    hasUnsavedChanges(pageNumber = null) {
        const targetPage = pageNumber || this.currentPage;
        
        // 설계 모드가 아니면 변경사항 없음
        if (!this.currentMode || 
            (this.currentMode !== 'design-classroom' && this.currentMode !== 'design-wireless')) {
            return false;
        }
        
        // 무선AP 설계 모드인 경우 savedApPositions 변경만 확인
        if (this.currentMode === 'design-wireless') {
            // savedApPositions의 변경사항 확인
            // 초기 상태와 비교하기 위해 lastSavedStateByPage에 savedApPositions 해시 저장 필요
            // 간단하게는 savedApPositions가 비어있지 않고, 마지막 저장 상태와 다르면 변경사항으로 간주
            // 하지만 더 정확하게는 초기 상태를 저장하고 비교해야 함
            // 일단은 AP/MDF 요소를 제외하고 다른 요소들만 비교
        }
        
        // 현재 페이지의 요소 가져오기 (무선AP 설계 모드에서는 AP/MDF 제외)
        const currentPageElements = this.core.state.elements.filter(el => {
            if (!el || (!el.id && !el.elementType)) return false;
            const elPage = el.pageNumber || 1;
            if (elPage !== targetPage) return false;
            
            // 무선AP 설계 모드에서는 AP/MDF 요소 제외 (동적으로 생성/제거되므로)
            if (this.currentMode === 'design-wireless') {
                if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                    return false;
                }
            }
            
            return true;
        });
        
        // 현재 상태의 해시 계산
        const currentHash = JSON.stringify(currentPageElements.map(el => ({
            id: el.id,
            type: el.elementType,
            x: el.xCoordinate,
            y: el.yCoordinate,
            w: el.width,
            h: el.height
        })).sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString())));
        
        // 마지막 저장 상태가 없으면 (아직 저장한 적이 없으면) 초기 상태와 비교
        if (!this.lastSavedStateByPage[targetPage]) {
            // localElementsByPage에 저장된 초기 상태와 비교 (AP/MDF 제외)
            if (this.localElementsByPage[targetPage] && this.localElementsByPage[targetPage].length > 0) {
                const initialElements = this.localElementsByPage[targetPage].filter(el => {
                    // 무선AP 설계 모드에서는 AP/MDF 제외
                    if (this.currentMode === 'design-wireless') {
                        if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                            return false;
                        }
                    }
                    return true;
                });
                
                const initialHash = JSON.stringify(initialElements.map(el => ({
                    id: el.id,
                    type: el.elementType,
                    x: el.xCoordinate,
                    y: el.yCoordinate,
                    w: el.width,
                    h: el.height
                })).sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString())));
                
                // 초기 상태와 다르면 변경사항 있음
                if (currentHash !== initialHash) {
                    // 변경된 요소 상세 분석
                    const initialElementMap = new Map();
                    initialElements.forEach(el => {
                        const key = `${el.elementType}_${el.id || el.referenceId || 'unknown'}`;
                        initialElementMap.set(key, el);
                    });
                    
                    const currentElementMap = new Map();
                    currentPageElements.forEach(el => {
                        const key = `${el.elementType}_${el.id || el.referenceId || 'unknown'}`;
                        currentElementMap.set(key, el);
                    });
                    
                    const addedElements = [];
                    const removedElements = [];
                    const modifiedElements = [];
                    
                    // 추가된 요소 찾기
                    currentElementMap.forEach((el, key) => {
                        if (!initialElementMap.has(key)) {
                            addedElements.push({
                                type: el.elementType,
                                id: el.id || el.referenceId,
                                name: el.name || el.label || '이름 없음',
                                position: { x: el.xCoordinate, y: el.yCoordinate },
                                size: { w: el.width, h: el.height }
                            });
                        }
                    });
                    
                    // 삭제된 요소 찾기
                    initialElementMap.forEach((el, key) => {
                        if (!currentElementMap.has(key)) {
                            removedElements.push({
                                type: el.elementType,
                                id: el.id || el.referenceId,
                                name: el.name || el.label || '이름 없음'
                            });
                        }
                    });
                    
                    // 수정된 요소 찾기
                    initialElementMap.forEach((initialEl, key) => {
                        const currentEl = currentElementMap.get(key);
                        if (currentEl) {
                            const initialProps = {
                                x: initialEl.xCoordinate,
                                y: initialEl.yCoordinate,
                                w: initialEl.width,
                                h: initialEl.height,
                                rotation: initialEl.rotation || 0
                            };
                            const currentProps = {
                                x: currentEl.xCoordinate,
                                y: currentEl.yCoordinate,
                                w: currentEl.width,
                                h: currentEl.height,
                                rotation: currentEl.rotation || 0
                            };
                            
                            if (JSON.stringify(initialProps) !== JSON.stringify(currentProps)) {
                                modifiedElements.push({
                                    type: currentEl.elementType,
                                    id: currentEl.id || currentEl.referenceId,
                                    name: currentEl.name || currentEl.label || '이름 없음',
                                    changes: {
                                        before: initialProps,
                                        after: currentProps
                                    }
                                });
                            }
                        }
                    });
                    
                    console.log('⚠️ 저장되지 않은 변경사항 감지됨 (일반 요소 변경 - 초기 상태와 비교)', {
                        targetPage,
                        mode: this.currentMode,
                        initialCount: initialElements.length,
                        currentCount: currentPageElements.length,
                        addedElements: addedElements.length > 0 ? addedElements : '없음',
                        removedElements: removedElements.length > 0 ? removedElements : '없음',
                        modifiedElements: modifiedElements.length > 0 ? modifiedElements : '없음',
                        summary: {
                            추가: addedElements.length,
                            삭제: removedElements.length,
                            수정: modifiedElements.length
                        }
                    });
                    return true;
                }
            } else {
                // 초기 상태도 없고 현재 요소도 없으면 변경사항 없음
                if (currentPageElements.length === 0) {
                    return false;
                }
                // 초기 상태는 없지만 현재 요소가 있으면 변경사항으로 간주하지 않음 (아직 초기화되지 않은 상태)
                // 무선AP 설계 모드에서는 AP/MDF를 제외하고 비교했으므로, 여기서는 변경사항 없음으로 판단
                return false;
            }
        } else {
            // 마지막 저장 상태와 비교
            // 무선AP 설계 모드에서는 lastSavedElements도 필터링하여 개수 비교
            let lastSavedCount = 0;
            const lastSavedState = this.lastSavedStateByPage[targetPage];
            if (lastSavedState && lastSavedState.elementList) {
                const lastSavedElements = lastSavedState.elementList;
                if (this.currentMode === 'design-wireless') {
                    // wireless_ap와 mdf_idf 제외
                    const filteredLastSavedElements = lastSavedElements.filter(el => {
                        return el.type !== 'wireless_ap' && el.type !== 'mdf_idf';
                    });
                    lastSavedCount = filteredLastSavedElements.length;
                } else {
                    lastSavedCount = lastSavedState.elementCount || lastSavedElements.length;
                }
            } else if (lastSavedState) {
                lastSavedCount = lastSavedState.elementCount || 0;
            }
            
            if (currentPageElements.length !== lastSavedCount) {
                // 개수 차이 상세 분석
                const currentElementIds = currentPageElements.map(el => ({
                    type: el.elementType,
                    id: el.id || el.referenceId,
                    name: el.name || el.label || '이름 없음'
                }));
                
                // 저장된 요소 목록이 있으면 비교 (lastSavedStateByPage에 요소 목록 저장 시)
                // 무선AP 설계 모드에서는 AP/MDF 요소 제외
                const lastSavedElements = (this.lastSavedStateByPage[targetPage].elementList || []).filter(el => {
                    if (this.currentMode === 'design-wireless') {
                        if (el.type === 'wireless_ap' || el.type === 'mdf_idf') {
                            return false;
                        }
                    }
                    return true;
                });
                const lastSavedElementIds = lastSavedElements.map(el => ({
                    type: el.type,
                    id: el.id,
                    name: el.name || '이름 없음'
                }));
                
                // 추가/삭제된 요소 찾기
                const currentIdsSet = new Set(currentElementIds.map(e => `${e.type}_${e.id}`));
                const lastSavedIdsSet = new Set(lastSavedElementIds.map(e => `${e.type}_${e.id}`));
                
                const addedElements = currentElementIds.filter(e => !lastSavedIdsSet.has(`${e.type}_${e.id}`));
                const removedElements = lastSavedElementIds.filter(e => !currentIdsSet.has(`${e.type}_${e.id}`));
                
                // 상세 로그 출력
                console.log('⚠️ 저장되지 않은 변경사항 감지됨 (일반 요소 개수 변경)', {
                    targetPage,
                    mode: this.currentMode,
                    lastSavedCount,
                    currentCount: currentPageElements.length,
                    difference: currentPageElements.length - lastSavedCount,
                    lastSavedElementsCount: lastSavedElements.length,
                    summary: {
                        추가: addedElements.length,
                        삭제: removedElements.length,
                        총_변경: addedElements.length + removedElements.length
                    }
                });
                
                if (addedElements.length > 0) {
                    console.log('📝 추가된 요소:', addedElements);
                }
                if (removedElements.length > 0) {
                    console.log('🗑️ 삭제된 요소:', removedElements);
                }
                if (addedElements.length === 0 && removedElements.length === 0) {
                    console.log('ℹ️ 추가/삭제된 요소 없음 (개수 차이는 필터링 차이로 인한 것일 수 있음)');
                }
                return true;
            }
            
            // 무선AP 설계 모드에서는 일반 요소 해시 비교를 건너뛰고 AP 위치 비교만 수행
            // (일반 요소는 교실, 건물 등이고, 이들은 AP 설계 모드에서 변경되지 않아야 함)
            if (this.currentMode !== 'design-wireless') {
                const lastSavedHash = this.lastSavedStateByPage[targetPage].elementHash;
                if (lastSavedHash && currentHash !== lastSavedHash) {
                    // 해시가 다르면 요소 내용이 변경된 것
                    // 마지막 저장 상태의 요소 정보는 없으므로 현재 요소 정보만 표시
                    const changedElements = currentPageElements.map(el => ({
                        type: el.elementType,
                        id: el.id || el.referenceId,
                        name: el.name || el.label || '이름 없음',
                        position: { x: el.xCoordinate, y: el.yCoordinate },
                        size: { w: el.width, h: el.height },
                        rotation: el.rotation || 0
                    }));
                    
                    console.log('⚠️ 저장되지 않은 변경사항 감지됨 (일반 요소 내용 변경)', {
                        targetPage,
                        mode: this.currentMode,
                        elementCount: currentPageElements.length,
                        changedElements: changedElements.length > 10 
                            ? changedElements.slice(0, 10).concat([`... 외 ${changedElements.length - 10}개`])
                            : changedElements,
                        note: '요소의 위치, 크기, 회전 등이 변경되었을 수 있습니다.'
                    });
                    return true;
                }
            }
        }
        
        // 무선AP 설계 모드인 경우 savedApPositions 변경 확인
        if (this.currentMode === 'design-wireless') {
            // savedApPositions의 초기 상태와 비교
            const initialApPositions = this.initialApPositionsByPage[targetPage];
            
            console.log('🔍 AP 위치 변경 감지 시작:', {
                targetPage,
                hasInitialApPositions: !!initialApPositions,
                initialApPositionsType: typeof initialApPositions,
                initialApPositionsKeys: initialApPositions ? Object.keys(initialApPositions).sort() : [],
                initialApPositionsCount: initialApPositions ? Object.keys(initialApPositions).length : 0,
                hasSavedApPositions: !!(window.floorPlanApp && window.floorPlanApp.savedApPositions),
                savedApPositionsKeys: window.floorPlanApp && window.floorPlanApp.savedApPositions ? Object.keys(window.floorPlanApp.savedApPositions).sort() : [],
                savedApPositionsCount: window.floorPlanApp && window.floorPlanApp.savedApPositions ? Object.keys(window.floorPlanApp.savedApPositions).length : 0
            });
            
            // initialApPositions가 undefined가 아니고 객체인 경우에만 비교
            if (initialApPositions && typeof initialApPositions === 'object' && Object.keys(initialApPositions).length >= 0) {
                // 초기 상태가 있으면 현재 상태와 비교
                if (window.floorPlanApp && window.floorPlanApp.savedApPositions) {
                    const currentApPositions = window.floorPlanApp.savedApPositions;
                    
                    // 현재 페이지의 AP만 비교 (다른 페이지의 AP는 제외)
                    // initialApPositions와 currentApPositions에서 현재 페이지의 교실에 속한 AP만 추출
                    const currentPageRooms = this.core.state.elements.filter(el => {
                        if (el.elementType !== 'room') return false;
                        const elPage = el.pageNumber || 1;
                        return elPage === targetPage;
                    });
                    
                    const currentPageRoomIds = new Set();
                    currentPageRooms.forEach(room => {
                        const roomId = room.referenceId || room.classroomId || room.id;
                        if (roomId) {
                            currentPageRoomIds.add(String(roomId));
                        }
                    });
                    
                    console.log('🔍 현재 페이지 교실 정보:', {
                        targetPage,
                        currentPageRoomsCount: currentPageRooms.length,
                        currentPageRoomIds: Array.from(currentPageRoomIds).sort(),
                        roomDetails: currentPageRooms.map(r => ({
                            id: r.id,
                            referenceId: r.referenceId,
                            classroomId: r.classroomId,
                            name: r.name || r.label,
                            pageNumber: r.pageNumber || 1
                        }))
                    });
                    
                    // 현재 페이지의 교실에 속한 AP만 필터링
                    // initialApPositions는 이미 현재 페이지의 AP만 필터링된 상태로 저장되어 있으므로
                    // currentApPositions에서도 현재 페이지의 AP만 필터링하여 비교
                    const currentApPositionsForPage = {};
                    
                    if (!this.modeManager || !this.modeManager.wirelessAps) {
                        console.warn('⚠️ modeManager 또는 wirelessAps가 없음:', {
                            hasModeManager: !!this.modeManager,
                            hasWirelessAps: !!(this.modeManager && this.modeManager.wirelessAps)
                        });
                    }
                    
                    Object.keys(currentApPositions).forEach(apId => {
                        // AP가 속한 교실 찾기 (wirelessAps 데이터에서 확인)
                        if (this.modeManager && this.modeManager.wirelessAps) {
                            const ap = this.modeManager.wirelessAps.find(a => String(a.apId) === apId);
                            if (ap && ap.classroomId) {
                                const classroomId = String(ap.classroomId);
                                if (currentPageRoomIds.has(classroomId)) {
                                    // 깊은 복사로 저장 (참조가 아닌 값 복사)
                                    currentApPositionsForPage[apId] = JSON.parse(JSON.stringify(currentApPositions[apId]));
                                }
                            } else {
                                console.log('🔍 AP 필터링 스킵:', {
                                    apId,
                                    hasAp: !!ap,
                                    hasClassroomId: !!(ap && ap.classroomId),
                                    classroomId: ap ? ap.classroomId : null
                                });
                            }
                        }
                    });
                    
                    console.log('🔍 AP 필터링 결과:', {
                        targetPage,
                        currentApPositionsKeys: Object.keys(currentApPositions).sort(),
                        currentApPositionsForPageKeys: Object.keys(currentApPositionsForPage).sort(),
                        currentApPositionsCount: Object.keys(currentApPositions).length,
                        currentApPositionsForPageCount: Object.keys(currentApPositionsForPage).length
                    });
                    
                    // initialApPositions는 이미 현재 페이지의 AP만 포함되어 있으므로 직접 비교
                    // 단, 키 순서가 다를 수 있으므로 정렬하여 비교
                    // 깊은 복사로 비교하여 참조 비교가 아닌 값 비교 수행
                    const sortedInitial = {};
                    Object.keys(initialApPositions).sort().forEach(key => {
                        sortedInitial[key] = JSON.parse(JSON.stringify(initialApPositions[key]));
                    });
                    const sortedCurrent = {};
                    Object.keys(currentApPositionsForPage).sort().forEach(key => {
                        sortedCurrent[key] = JSON.parse(JSON.stringify(currentApPositionsForPage[key]));
                    });
                    const initialHash = JSON.stringify(sortedInitial);
                    const currentHash = JSON.stringify(sortedCurrent);
                    
                    // 상세 디버깅 로그
                    console.log('🔍 AP 위치 비교 상세:', {
                        targetPage,
                        initialKeys: Object.keys(initialApPositions).sort(),
                        currentKeys: Object.keys(currentApPositionsForPage).sort(),
                        initialKeysCount: Object.keys(initialApPositions).length,
                        currentKeysCount: Object.keys(currentApPositionsForPage).length,
                        initialSample: Object.keys(sortedInitial).length > 0 ? sortedInitial[Object.keys(sortedInitial)[0]] : null,
                        currentSample: Object.keys(sortedCurrent).length > 0 ? sortedCurrent[Object.keys(sortedCurrent)[0]] : null,
                        initialHash: initialHash.substring(0, 200),
                        currentHash: currentHash.substring(0, 200),
                        hashEqual: initialHash === currentHash
                    });
                    
                    if (initialHash !== currentHash) {
                        // 차이점 상세 분석
                        const initialKeysSet = new Set(Object.keys(sortedInitial));
                        const currentKeysSet = new Set(Object.keys(sortedCurrent));
                        const onlyInInitial = Array.from(initialKeysSet).filter(k => !currentKeysSet.has(k));
                        const onlyInCurrent = Array.from(currentKeysSet).filter(k => !initialKeysSet.has(k));
                        const commonKeys = Array.from(initialKeysSet).filter(k => currentKeysSet.has(k));
                        
                        // 변경된 AP 상세 정보
                        const changedAps = commonKeys.filter(key => {
                            const init = JSON.stringify(sortedInitial[key]);
                            const curr = JSON.stringify(sortedCurrent[key]);
                            return init !== curr;
                        }).map(key => {
                            const ap = this.modeManager && this.modeManager.wirelessAps 
                                ? this.modeManager.wirelessAps.find(a => String(a.apId) === key)
                                : null;
                            return {
                                apId: key,
                                apName: ap ? (ap.apName || `AP-${key}`) : `AP-${key}`,
                                classroomId: ap ? ap.classroomId : null,
                                classroomName: ap ? ap.classroomName : null,
                                before: sortedInitial[key],
                                after: sortedCurrent[key],
                                changes: {
                                    position: sortedInitial[key].x !== sortedCurrent[key].x || 
                                             sortedInitial[key].y !== sortedCurrent[key].y 
                                        ? { 
                                            before: { x: sortedInitial[key].x, y: sortedInitial[key].y },
                                            after: { x: sortedCurrent[key].x, y: sortedCurrent[key].y }
                                          }
                                        : null,
                                    shape: sortedInitial[key].shapeType !== sortedCurrent[key].shapeType
                                        ? { before: sortedInitial[key].shapeType, after: sortedCurrent[key].shapeType }
                                        : null,
                                    color: sortedInitial[key].borderColor !== sortedCurrent[key].borderColor ||
                                           sortedInitial[key].backgroundColor !== sortedCurrent[key].backgroundColor
                                        ? {
                                            before: { 
                                                border: sortedInitial[key].borderColor, 
                                                background: sortedInitial[key].backgroundColor 
                                            },
                                            after: { 
                                                border: sortedCurrent[key].borderColor, 
                                                background: sortedCurrent[key].backgroundColor 
                                            }
                                          }
                                        : null
                                }
                            };
                        });
                        
                        const removedAps = onlyInInitial.map(key => {
                            const ap = this.modeManager && this.modeManager.wirelessAps 
                                ? this.modeManager.wirelessAps.find(a => String(a.apId) === key)
                                : null;
                            return {
                                apId: key,
                                apName: ap ? (ap.apName || `AP-${key}`) : `AP-${key}`,
                                classroomId: ap ? ap.classroomId : null,
                                classroomName: ap ? ap.classroomName : null,
                                lastPosition: sortedInitial[key]
                            };
                        });
                        
                        const addedAps = onlyInCurrent.map(key => {
                            const ap = this.modeManager && this.modeManager.wirelessAps 
                                ? this.modeManager.wirelessAps.find(a => String(a.apId) === key)
                                : null;
                            return {
                                apId: key,
                                apName: ap ? (ap.apName || `AP-${key}`) : `AP-${key}`,
                                classroomId: ap ? ap.classroomId : null,
                                classroomName: ap ? ap.classroomName : null,
                                currentPosition: sortedCurrent[key]
                            };
                        });
                        
                        console.log('🔍 AP 위치 변경 감지 - 상세 분석:', {
                            targetPage,
                            onlyInInitial,
                            onlyInCurrent,
                            commonKeys,
                            differences: changedAps
                        });
                        
                        console.log('⚠️ 저장되지 않은 변경사항 감지됨 (AP 위치 변경)', {
                            targetPage,
                            mode: this.currentMode,
                            summary: {
                                수정된_AP: changedAps.length,
                                삭제된_AP: removedAps.length,
                                추가된_AP: addedAps.length
                            },
                            changedAps: changedAps.length > 0 ? changedAps : '없음',
                            removedAps: removedAps.length > 0 ? removedAps : '없음',
                            addedAps: addedAps.length > 0 ? addedAps : '없음'
                        });
                        return true; // 현재 페이지의 AP 위치가 변경되었음
                    } else {
                        console.log('✅ AP 위치 변경 없음:', {
                            targetPage,
                            initialKeys: Object.keys(initialApPositions).sort(),
                            currentKeys: Object.keys(currentApPositionsForPage).sort()
                        });
                    }
                }
            } else {
                // initialApPositions가 없거나 빈 객체가 아니면 아직 초기화되지 않은 상태
                // 이 경우 변경사항이 없다고 판단 (다른 요소들의 변경사항은 이미 위에서 확인했으므로)
                console.log('ℹ️ initialApPositions가 없음 (변경사항 없음으로 판단):', {
                    targetPage,
                    initialApPositions: initialApPositions
                });
            }
        }
        
        return false;
    }
    
    closeWorkspace() {
        // 저장되지 않은 변경사항 확인
        if (this.hasUnsavedChanges()) {
            console.log('⚠️ 저장되지 않은 변경사항 감지 - 워크스페이스 닫기 시도', {
                currentMode: this.currentMode,
                currentPage: this.currentPage
            });
            if (!confirm('저장을 하지 않았습니다. 저장을 하지 않으면 수정사항이 저장되지 않습니다.\n\n정말 닫으시겠습니까?')) {
                console.log('❌ 사용자가 워크스페이스 닫기 취소');
                return; // 사용자가 취소하면 닫기 중단
            }
            console.log('✅ 사용자가 워크스페이스 닫기 확인');
        }
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
        
        // 2. 학교 ID 및 페이지 정보 업데이트
        this.currentSchoolId = parseInt(schoolId);
        this.core.currentSchoolId = this.currentSchoolId;
        // 새 학교 선택 시 항상 1페이지부터 시작
        this.currentPage = 1;
        if (this.core) {
            this.core.currentPage = 1;
        }
        
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
            // 기존 DataSyncManager.load 대신, 페이지/페이지수 정보를 함께 처리하는 loadFloorPlan 사용
            // 이렇게 해야 초기 진입 시에도 올바른 maxPage와 페이지 표시(1 / maxPage)를 보장할 수 있음
            await this.loadFloorPlan(this.currentSchoolId);
            
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
            // loadFloorPlan 내부에서 요소 로드가 이미 수행되었으므로,
            // 여기서는 현재 elements 상태만 보고 뷰를 조정한다.
            if (this.core.state.elements && this.core.state.elements.length > 0) {
                console.log('📍 요소에 맞춰 뷰 조정 (onWorkspaceSchoolChange):', this.core.state.elements.length, '개');
                this.core.fitToElements();
            } else {
                console.log('📍 기본 뷰 (빈 캔버스, onWorkspaceSchoolChange)');
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
        
        // 설계 모드에서 보기 모드로 전환 시 저장되지 않은 변경사항 확인
        const isCurrentDesignMode = this.currentMode === 'design-classroom' || this.currentMode === 'design-wireless';
        const willBeViewMode = mode === 'view-equipment' || mode === 'view-wireless' || mode === 'equipment-view' || mode === 'wireless-ap-view';
        
        if (isCurrentDesignMode && willBeViewMode) {
            if (this.hasUnsavedChanges()) {
                console.log('⚠️ 저장되지 않은 변경사항 감지 - 보기 모드로 전환 시도', {
                    currentMode: this.currentMode,
                    targetMode: mode,
                    currentPage: this.currentPage
                });
                if (!confirm('저장을 하지 않았습니다. 저장을 하지 않으면 수정사항이 저장되지 않습니다.\n\n정말 보기 모드로 이동하시겠습니까?')) {
                    console.log('❌ 사용자가 보기 모드 전환 취소');
                    // 사용자가 취소하면 모드 선택 드롭다운을 이전 값으로 복원
                    const workspaceModeSelect = document.getElementById('workspace-mode-select');
                    if (workspaceModeSelect) {
                        workspaceModeSelect.value = this.currentMode || '';
                    }
                    return; // 모드 전환 중단
                }
                console.log('✅ 사용자가 보기 모드 전환 확인');
            }
        }
        
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
                
                // 현재 페이지의 요소만 필터링 및 중복 제거
                const seenElementKeys = new Set();
                this.core.state.elements = this.core.state.elements.filter(el => {
                    if (!el || (!el.id && !el.elementType)) return false;
                    
                    // 페이지 필터링
                    const elPage = el.pageNumber;
                    const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
                    if (normalizedPage !== this.currentPage) {
                        return false;
                    }
                    
                    // 중복 체크: ID와 좌표를 모두 확인하여 완전히 동일한 요소 제거
                    const elementKey = el.id 
                        ? `${el.id}_${el.xCoordinate}_${el.yCoordinate}` 
                        : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                    
                    if (seenElementKeys.has(elementKey)) {
                        console.warn(`⚠️ 중복 요소 제거 (보기 모드 전환): ${elementKey}`);
                        return false;
                    }
                    seenElementKeys.add(elementKey);
                    return true;
                });
                this.core.markDirty();
                this.core.render && this.core.render();
                console.log(`✅ 현재 페이지 ${this.currentPage} 요소만 로드 완료: ${this.core.state.elements.length}개`);
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
        const isViewMode = mode.startsWith('view-') || mode === 'equipment-view' || mode === 'wireless-ap-view';
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
            
            // 3. 서버에서 실제 maxPage를 먼저 조회하여 this.maxPage 업데이트
            try {
                const maxPageResponse = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=1`);
                if (maxPageResponse.ok) {
                    const maxPageData = await maxPageResponse.json();
                    const maxPageValue = parseInt(maxPageData.maxPage, 10);
                    if (maxPageData.success && !isNaN(maxPageValue) && maxPageValue > 0) {
                        // 서버에서 받은 maxPage가 현재 maxPage보다 클 때만 업데이트
                        // (작업 중인 페이지 수를 서버 응답으로 줄이지 않도록 보호)
                        if (maxPageValue >= this.maxPage) {
                            this.maxPage = maxPageValue;
                            console.log(`📄 저장 전 maxPage 업데이트: ${this.maxPage} (원본: ${maxPageData.maxPage}, 타입: ${typeof maxPageData.maxPage})`);
                        } else {
                            console.log(`ℹ️ 저장 전 maxPage 응답 무시 (서버 값이 더 작음): 현재=${this.maxPage}, 서버=${maxPageValue}`);
                        }
                    }
                }
            } catch (error) {
                console.warn('저장 전 maxPage 조회 실패:', error);
            }
            
            // 4. 서버에서 모든 페이지의 요소들 로드
            const allPageElements = await this.loadAllPageElements();
            
            // 5. 서버 요소의 ID 목록 생성 (중복 제거용)
            const serverElementIds = new Set(
                allPageElements
                    .filter(el => el.id && !el.id.toString().startsWith('temp'))
                    .map(el => el.id.toString())
            );
            
            // 6. 모든 페이지의 로컬 요소들을 수집 (localElementsByPage에서)
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
            
            // 7. 서버 요소와 로컬 요소를 병합
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
            
            // 모든 요소 병합: 다른 페이지 요소 + 다른 페이지 로컬 요소 + 현재 페이지 요소
            // currentPageElements가 빈 배열이어도 포함하여 삭제 상태를 반영
            // 중복 제거: 같은 ID의 요소가 여러 번 포함되지 않도록
            const mergedElementsMap = new Map();
            
            // 1. 다른 페이지 요소 추가
            otherPageElements.forEach(el => {
                if (el.id && !el.id.toString().startsWith('temp')) {
                    mergedElementsMap.set(el.id.toString(), el);
                }
            });
            
            // 2. 다른 페이지 로컬 요소 추가 (서버에 없는 것만)
            otherPageLocalElements.forEach(el => {
                if (el.id && !el.id.toString().startsWith('temp')) {
                    // 서버에 없거나 서버 요소와 다른 것만 추가
                    if (!mergedElementsMap.has(el.id.toString())) {
                        mergedElementsMap.set(el.id.toString(), el);
                    }
                } else {
                    // temp ID는 항상 추가 (새로 추가한 요소)
                    mergedElementsMap.set(`${el.elementType}_${el.xCoordinate}_${el.yCoordinate}_${Date.now()}`, el);
                }
            });
            
            // 3. 현재 페이지 요소 추가 (최우선, 삭제 상태 반영)
            currentPageElements.forEach(el => {
                if (el.id && !el.id.toString().startsWith('temp')) {
                    // 현재 페이지 요소는 항상 덮어쓰기 (최신 상태)
                    mergedElementsMap.set(el.id.toString(), el);
                } else {
                    // temp ID는 항상 추가 (새로 추가한 요소)
                    mergedElementsMap.set(`${el.elementType}_${el.xCoordinate}_${el.yCoordinate}_${Date.now()}`, el);
                }
            });
            
            const mergedElements = Array.from(mergedElementsMap.values());
            
            // 8. 임시로 core.state.elements를 모든 페이지 요소로 설정
            const originalElements = this.core.state.elements;
            this.core.state.elements = mergedElements;
            
            // 9. 교실 좌표 저장 (교실 설계 모드인 경우)
            let classroomSaveFailed = false;
            if (this.currentMode === 'design-classroom' && this.modeManager) {
                const classroomSaveResult = await this.saveClassroomCoordinates();
                if (classroomSaveResult === false) {
                    classroomSaveFailed = true;
                }
                
                // 교실 위치 변경 시 AP offset 업데이트 (교실 설계 모드 저장 시)
                await this.updateApOffsetsForChangedRooms(mergedElements);
            }
            
            // 10. 평면도 데이터 저장 (알림은 여기서 통합 표시)
            const result = await this.dataSyncManager.save(this.currentSchoolId, false); // 내부 알림 비활성화
            
            // 11. core.state.elements를 원래대로 복원 (현재 페이지 요소만)
            this.core.state.elements = originalElements;
            
            console.log('💾 평면도 저장 결과:', result);
            
            // result가 객체인 경우와 boolean인 경우 모두 처리
            if (result === true || (result && result.success === true)) {
                // 저장 성공 후 로컬 요소 저장소 초기화 (모든 요소가 서버에 저장되었으므로)
                this.localElementsByPage = {};
                console.log('🔄 저장 완료 후 로컬 요소 저장소 초기화');
                
                // 마지막 저장 상태 업데이트 (각 페이지별 요소 개수 및 해시 저장)
                const allPages = new Set();
                this.core.state.elements.forEach(el => {
                    const page = el.pageNumber || 1;
                    allPages.add(page);
                });
                allPages.forEach(page => {
                    // 무선AP 설계 모드에서는 AP/MDF 요소 제외
                    const pageElements = this.core.state.elements.filter(el => {
                        const elPage = el.pageNumber || 1;
                        if (elPage !== page) return false;
                        
                        // 무선AP 설계 모드에서는 AP/MDF 제외
                        if (this.currentMode === 'design-wireless') {
                            if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                                return false;
                            }
                        }
                        return true;
                    });
                    
                    if (!this.lastSavedStateByPage[page]) {
                        this.lastSavedStateByPage[page] = {};
                    }
                    this.lastSavedStateByPage[page].elementCount = pageElements.length;
                    
                    // 요소 목록 저장 (추가/삭제 감지용, AP/MDF 제외)
                    this.lastSavedStateByPage[page].elementList = pageElements.map(el => ({
                        id: el.id,
                        type: el.elementType,
                        name: el.name || el.label || '이름 없음',
                        x: el.xCoordinate,
                        y: el.yCoordinate,
                        w: el.width,
                        h: el.height
                    }));
                    
                    // 요소 해시 저장 (내용 변경 감지용, AP/MDF 제외)
                    const elementHash = JSON.stringify(pageElements.map(el => ({
                        id: el.id,
                        type: el.elementType,
                        x: el.xCoordinate,
                        y: el.yCoordinate,
                        w: el.width,
                        h: el.height
                    })).sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString())));
                    this.lastSavedStateByPage[page].elementHash = elementHash;
                });
                
                // 무선AP 설계 모드인 경우 initialApPositionsByPage도 업데이트 (저장 후 초기 상태로 설정)
                // 현재 페이지의 교실에 속한 AP만 저장 (다른 페이지의 AP는 제외)
                if (this.currentMode === 'design-wireless' && this.savedApPositions && this.modeManager) {
                    // 현재 페이지의 교실 요소 찾기
                    const currentPageRooms = this.core.state.elements.filter(el => {
                        if (el.elementType !== 'room') return false;
                        const elPage = el.pageNumber || 1;
                        return elPage === this.currentPage;
                    });
                    
                    const currentPageRoomIds = new Set();
                    currentPageRooms.forEach(room => {
                        const roomId = room.referenceId || room.classroomId || room.id;
                        if (roomId) {
                            currentPageRoomIds.add(String(roomId));
                        }
                    });
                    
                    // 현재 페이지의 교실에 속한 AP만 필터링
                    const apPositionsForPage = {};
                    if (this.modeManager.wirelessAps) {
                        Object.keys(this.savedApPositions).forEach(apId => {
                            // AP가 속한 교실 찾기
                            const ap = this.modeManager.wirelessAps.find(a => String(a.apId) === apId);
                            if (ap && ap.classroomId) {
                                const classroomId = String(ap.classroomId);
                                if (currentPageRoomIds.has(classroomId)) {
                                    apPositionsForPage[apId] = this.savedApPositions[apId];
                                }
                            }
                        });
                    }
                    
                    // 깊은 복사로 저장하여 이후 변경사항이 초기 상태에 영향을 주지 않도록 함
                    const savedInitialPositions = JSON.parse(JSON.stringify(apPositionsForPage));
                    this.initialApPositionsByPage[this.currentPage] = savedInitialPositions;
                    console.log(`💾 저장 완료 후 페이지 ${this.currentPage}의 초기 AP 위치 상태 업데이트 (${Object.keys(apPositionsForPage).length}개 AP)`, {
                        apIds: Object.keys(apPositionsForPage).sort(),
                        sample: Object.keys(apPositionsForPage).length > 0 ? apPositionsForPage[Object.keys(apPositionsForPage)[0]] : null,
                        savedApPositionsKeys: this.savedApPositions ? Object.keys(this.savedApPositions).sort() : []
                    });
                }
                
                // 12. 저장 후 서버에서 실제 maxPage를 다시 조회하여 업데이트
                try {
                    const maxPageResponse = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=1`);
                    if (maxPageResponse.ok) {
                        const maxPageData = await maxPageResponse.json();
                        const maxPageValue = parseInt(maxPageData.maxPage, 10);
                        if (maxPageData.success && !isNaN(maxPageValue) && maxPageValue > 0) {
                            this.maxPage = maxPageValue;
                            console.log(`📄 저장 후 maxPage 업데이트: ${this.maxPage} (원본: ${maxPageData.maxPage}, 타입: ${typeof maxPageData.maxPage})`);
                        }
                    }
                } catch (error) {
                    console.warn('저장 후 maxPage 조회 실패:', error);
                }
                
                // 13. (중단) 자동 빈 페이지 삭제 기능
                // cleanupEmptyPages는 서버에서 각 페이지 요소 수를 다시 조회해
                // 요소가 없는 페이지를 바로 삭제하는데,
                // 사용자가 해당 페이지를 건드리지 않고 저장만 해도
                // 예기치 않게 페이지가 삭제되는 문제가 있어 비활성화한다.
                // 필요 시, 명시적인 페이지 삭제 기능(deleteCurrentPage)을 사용하도록 제한한다.
                // await this.cleanupEmptyPages();
                
                // 14. 저장 후 maxPage 업데이트 및 페이지 정보 표시 업데이트
                this.updatePageDisplay();
                console.log(`📄 저장 후 페이지 정보 업데이트: ${this.currentPage} / ${this.maxPage}`);
                
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
     * 교실 위치 변경 시 AP offset 업데이트 (교실 설계 모드 저장 시)
     * @param {Array} mergedElements - 모든 페이지의 요소들 (교실 포함)
     */
    async updateApOffsetsForChangedRooms(mergedElements) {
        if (!window.floorPlanApp || !window.floorPlanApp.savedApPositions) {
            return;
        }
        
        const savedApPositions = window.floorPlanApp.savedApPositions;
        if (Object.keys(savedApPositions).length === 0) {
            return;
        }
        
        try {
            // 서버에서 AP 요소 로드
            const response = await fetch(`/floorplan/api/schools/${this.currentSchoolId}`);
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.elements) {
                console.log('ℹ️ AP offset 업데이트: 서버에 AP 데이터 없음');
                return;
            }
            
            const serverElements = result.data.elements;
            const serverAps = serverElements.filter(el => el.elementType === 'wireless_ap');
            
            if (serverAps.length === 0) {
                console.log('ℹ️ AP offset 업데이트: 서버에 AP 요소 없음');
                return;
            }
            
            // AP 정보 로드 (classroomId를 얻기 위해)
            let apInfoMap = {};
            try {
                const apInfoResponse = await fetch(`/floorplan/api/schools/${this.currentSchoolId}/wireless-aps`);
                const apInfoResult = await apInfoResponse.json();
                if (apInfoResult.success) {
                    const apList = apInfoResult.data?.wirelessAps || apInfoResult.data || [];
                    apList.forEach(ap => {
                        if (ap.apId) {
                            apInfoMap[String(ap.apId)] = ap;
                        }
                    });
                }
            } catch (e) {
                console.warn('⚠️ AP 정보 조회 실패 (계속 진행):', e);
            }
            
            // 교실 요소들 찾기
            const allRooms = mergedElements.filter(el => el.elementType === 'room');
            const serverRooms = serverElements.filter(el => el.elementType === 'room');
            
            let updatedCount = 0;
            
            // 서버의 각 AP에 대해 offset 재계산 (교실 위치가 변경된 경우만)
            serverAps.forEach(serverAp => {
                if (!serverAp.referenceId || serverAp.xCoordinate == null || serverAp.yCoordinate == null) {
                    return;
                }
                
                const apId = String(serverAp.referenceId);
                if (!savedApPositions[apId]) {
                    return;
                }
                
                // AP의 classroomId 찾기
                const apInfo = apInfoMap[apId];
                if (!apInfo || !apInfo.classroomId) {
                    return;
                }
                
                const classroomId = String(apInfo.classroomId);
                
                // 현재 교실 요소 찾기 (mergedElements에서 - saveClassroomCoordinates 이후의 최신 좌표)
                const currentRoomElement = allRooms.find(room => {
                    const roomRefId = room.referenceId ? String(room.referenceId) : null;
                    const roomClassroomId = room.classroomId ? String(room.classroomId) : null;
                    return (roomRefId === classroomId) || (roomClassroomId === classroomId);
                });
                
                if (!currentRoomElement) {
                    return;
                }
                
                // 서버의 교실 요소 찾기 (서버에서 로드한 요소 - saveClassroomCoordinates 이전의 좌표일 수 있음)
                // 하지만 실제로는 FloorPlanElement에서 로드하므로, Classroom 엔티티와 다를 수 있음
                // 따라서 mergedElements의 교실 좌표를 기준으로 비교하는 것이 더 정확함
                // 서버의 교실 요소는 참고용으로만 사용하고, 실제 비교는 mergedElements 기준으로 함
                const serverRoomElement = serverRooms.find(room => {
                    const roomRefId = room.referenceId ? String(room.referenceId) : null;
                    const roomClassroomId = room.classroomId ? String(room.classroomId) : null;
                    return (roomRefId === classroomId) || (roomClassroomId === classroomId);
                });
                
                // 서버의 교실 요소가 없으면 현재 교실 좌표를 기준으로 offset만 확인
                // (새로 추가된 교실이거나 서버에 아직 저장되지 않은 경우)
                if (!serverRoomElement) {
                    // 서버의 AP 좌표를 기준으로 offset 계산
                    const serverApX = serverAp.xCoordinate;
                    const serverApY = serverAp.yCoordinate;
                    const currentRoomX = currentRoomElement.xCoordinate || 0;
                    const currentRoomY = currentRoomElement.yCoordinate || 0;
                    const calculatedOffsetX = serverApX - currentRoomX;
                    const calculatedOffsetY = serverApY - currentRoomY;
                    const existingOffsetX = (savedApPositions[apId]?.x || 0);
                    const existingOffsetY = (savedApPositions[apId]?.y || 0);
                    
                    // offset이 불일치하면 업데이트
                    const offsetXMismatch = Math.abs(existingOffsetX - calculatedOffsetX) > 0.01;
                    const offsetYMismatch = Math.abs(existingOffsetY - calculatedOffsetY) > 0.01;
                    
                    if (offsetXMismatch || offsetYMismatch) {
                        savedApPositions[apId] = {
                            ...savedApPositions[apId],
                            x: calculatedOffsetX,
                            y: calculatedOffsetY
                        };
                        updatedCount++;
                        console.log('🔄 AP offset 업데이트 (서버 교실 없음, offset 불일치):', {
                            apId,
                            classroomId,
                            기존_offsetX: existingOffsetX.toFixed(2),
                            기존_offsetY: existingOffsetY.toFixed(2),
                            새로운_offsetX: calculatedOffsetX.toFixed(2),
                            새로운_offsetY: calculatedOffsetY.toFixed(2)
                        });
                    }
                    return;
                }
                
                // 현재 교실 좌표 (좌상단 좌표) - mergedElements에서 가져온 최신 좌표
                // saveClassroomCoordinates 이후의 최신 좌표이므로, 이것을 기준으로 offset 계산
                const currentRoomX = currentRoomElement.xCoordinate || 0;
                const currentRoomY = currentRoomElement.yCoordinate || 0;
                
                // 서버의 AP 절대 좌표 (중앙 좌표)
                const serverApX = serverAp.xCoordinate;
                const serverApY = serverAp.yCoordinate;
                
                // 현재 savedApPositions의 offset (교실 좌상단 기준)
                const existingOffsetX = (savedApPositions[apId]?.x || 0);
                const existingOffsetY = (savedApPositions[apId]?.y || 0);
                
                // 서버의 AP 좌표를 기준으로 계산한 offset (교실 좌상단 기준)
                // 서버의 AP 중앙 좌표에서 현재 교실 좌상단 좌표를 빼서 offset 계산
                const calculatedOffsetX = serverApX - currentRoomX;
                const calculatedOffsetY = serverApY - currentRoomY;
                
                // offset이 일치하는지 확인 (0.01 이상 차이가 있으면 불일치로 간주)
                const offsetXMismatch = Math.abs(existingOffsetX - calculatedOffsetX) > 0.01;
                const offsetYMismatch = Math.abs(existingOffsetY - calculatedOffsetY) > 0.01;
                
                // offset이 일치하면 업데이트하지 않음
                // (교실 위치가 변경되지 않았고, 서버의 AP 좌표와 현재 offset이 일치하는 경우)
                if (!offsetXMismatch && !offsetYMismatch) {
                    console.log('ℹ️ AP offset 업데이트 건너뜀 (offset 일치):', {
                        apId,
                        classroomId,
                        currentRoomX: currentRoomX.toFixed(2),
                        currentRoomY: currentRoomY.toFixed(2),
                        existingOffsetX: existingOffsetX.toFixed(2),
                        existingOffsetY: existingOffsetY.toFixed(2),
                        calculatedOffsetX: calculatedOffsetX.toFixed(2),
                        calculatedOffsetY: calculatedOffsetY.toFixed(2),
                        serverApX: serverApX.toFixed(2),
                        serverApY: serverApY.toFixed(2)
                    });
                    return;
                }
                
                // 새로운 offset 계산: 서버의 AP 절대 좌표 - 현재 교실 좌표
                // 서버의 AP 좌표는 이미 절대 좌표이므로, 현재 교실 좌표를 빼서 새로운 offset 계산
                const newOffsetX = calculatedOffsetX;
                const newOffsetY = calculatedOffsetY;
                
                // savedApPositions 업데이트
                const existingPosition = savedApPositions[apId] || {};
                savedApPositions[apId] = {
                    ...existingPosition,
                    x: newOffsetX,
                    y: newOffsetY
                };
                
                updatedCount++;
                
                console.log('🔄 AP offset 업데이트 (교실 위치 변경 반영):', {
                    apId,
                    classroomId,
                    기존_offsetX: (existingPosition.x || 0).toFixed(2),
                    기존_offsetY: (existingPosition.y || 0).toFixed(2),
                    새로운_offsetX: newOffsetX.toFixed(2),
                    새로운_offsetY: newOffsetY.toFixed(2),
                    serverApX: serverApX.toFixed(2),
                    serverApY: serverApY.toFixed(2),
                    serverRoomX: serverRoomX.toFixed(2),
                    serverRoomY: serverRoomY.toFixed(2),
                    currentRoomX: currentRoomX.toFixed(2),
                    currentRoomY: currentRoomY.toFixed(2)
                });
            });
            
            if (updatedCount > 0) {
                console.log(`✅ AP offset 업데이트 완료: ${updatedCount}개 AP`);
            }
            
        } catch (error) {
            console.warn('⚠️ AP offset 업데이트 실패 (계속 진행):', error);
        }
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
            const displayText = `페이지 ${this.currentPage} / ${this.maxPage}`;
            pageInfo.textContent = displayText;
            console.log(`📄 updatePageDisplay 호출: ${displayText} (currentPage: ${this.currentPage}, maxPage: ${this.maxPage})`);
        } else {
            console.warn('⚠️ page-info-display 요소를 찾을 수 없습니다.');
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
        
        // 저장되지 않은 변경사항 확인
        if (this.hasUnsavedChanges()) {
            console.log('⚠️ 저장되지 않은 변경사항 감지 - 페이지 이동 시도', {
                currentMode: this.currentMode,
                currentPage: this.currentPage,
                targetPage: pageNumber
            });
            if (!confirm('저장을 하지 않았습니다. 저장을 하지 않으면 수정사항이 저장되지 않습니다.\n\n정말 다른 페이지로 이동하시겠습니까?')) {
                console.log('❌ 사용자가 페이지 이동 취소');
                return; // 사용자가 취소하면 페이지 이동 중단
            }
            console.log('✅ 사용자가 페이지 이동 확인');
        }
        
        // 현재 페이지의 모든 요소를 메모리에 저장 (서버에 저장되지 않은 모든 요소)
        if (this.core && this.core.state && this.core.state.elements) {
            // 현재 페이지의 모든 요소 저장 (나중에 서버 요소와 비교하여 로컬 요소만 유지)
            const currentPageElements = this.core.state.elements.filter(el => {
                if (!el || (!el.id && !el.elementType)) return false;
                const elPage = el.pageNumber || this.currentPage;
                return elPage === this.currentPage;
            });
            
            // 무선AP 설계 모드에서는 AP/MDF 요소 제외
            const elementsForComparison = currentPageElements.filter(el => {
                if (this.currentMode === 'design-wireless') {
                    if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                        return false;
                    }
                }
                return true;
            });
            
            // 빈 배열이어도 저장 (삭제 상태 반영, AP/MDF 제외)
            this.localElementsByPage[this.currentPage] = JSON.parse(JSON.stringify(elementsForComparison));
            console.log(`💾 페이지 ${this.currentPage}의 요소 ${elementsForComparison.length}개 저장 (로컬, AP/MDF 제외)`);
            
            // 페이지를 처음 로드했을 때 초기 상태를 lastSavedStateByPage에 저장 (변경사항 감지용)
            if (!this.lastSavedStateByPage[this.currentPage]) {
                // 요소 목록 저장 (추가/삭제 감지용, AP/MDF 제외)
                const elementList = elementsForComparison.map(el => ({
                    id: el.id,
                    type: el.elementType,
                    name: el.name || el.label || '이름 없음',
                    x: el.xCoordinate,
                    y: el.yCoordinate,
                    w: el.width,
                    h: el.height
                }));
                
                const elementHash = JSON.stringify(elementsForComparison.map(el => ({
                    id: el.id,
                    type: el.elementType,
                    x: el.xCoordinate,
                    y: el.yCoordinate,
                    w: el.width,
                    h: el.height
                })).sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString())));
                
                this.lastSavedStateByPage[this.currentPage] = {
                    elementCount: elementsForComparison.length,
                    elementHash: elementHash,
                    elementList: elementList
                };
                
                // 무선AP 설계 모드인 경우 초기 AP 위치 상태는 onPageSwitch에서 저장됨
                // (해당 페이지의 AP만 저장하도록 처리)
                
                console.log(`💾 페이지 ${this.currentPage}의 초기 상태 저장 (변경사항 감지용, AP/MDF 제외)`);
            }
        }
        
        // 페이지 변경 (저장은 나중에 저장 버튼을 눌렀을 때)
        this.currentPage = pageNumber;
        
        // Core에 현재 페이지 정보 업데이트
        if (this.core) {
            this.core.currentPage = pageNumber;
        }
        
        // 다음 페이지로 넘기면 자동으로 페이지 생성 (loadPageElements 전에 설정)
        if (pageNumber > this.maxPage) {
            this.maxPage = pageNumber;
            console.log(`📄 maxPage 자동 증가 (switchPage): ${this.maxPage}`);
        }
        
        // 로컬에 빈 배열이 저장되어 있으면 (모든 요소가 삭제된 경우) 서버 요소를 로드하지 않음
        if (this.localElementsByPage.hasOwnProperty(pageNumber) && 
            Array.isArray(this.localElementsByPage[pageNumber]) && 
            this.localElementsByPage[pageNumber].length === 0) {
            console.log(`🗑️ 페이지 ${pageNumber}의 모든 요소가 삭제됨 (서버 요소 로드 건너뜀)`);
            this.core.state.elements = [];
            this.core.currentPage = pageNumber;
            this.core.markDirty();
            this.core.render && this.core.render();
            this.updatePageDisplay();
            if (this.modeManager && typeof this.modeManager.onPageSwitch === 'function') {
                this.modeManager.onPageSwitch(pageNumber);
            }
            console.log(`📄 페이지 전환: ${pageNumber} (최대: ${this.maxPage})`);
            return;
        }
        
        // 해당 페이지의 요소들만 필터링하여 표시
        const loadResult = await this.loadPageElements(pageNumber);
        
        // loadPageElements에서 받은 maxPage 정보로 업데이트 (서버에서 받은 값이 더 정확)
        const loadResultMaxPageValue = parseInt(loadResult?.maxPage, 10);
        if (loadResult && loadResult.success && !isNaN(loadResultMaxPageValue) && loadResultMaxPageValue > 0) {
            // 서버에서 받은 maxPage가 현재 maxPage보다 크거나 같으면 업데이트
            if (loadResultMaxPageValue >= this.maxPage) {
                this.maxPage = loadResultMaxPageValue;
                console.log(`📄 maxPage 업데이트 (switchPage - 서버 값): ${this.maxPage} (원본: ${loadResult.maxPage}, 타입: ${typeof loadResult.maxPage})`);
            }
        }
        
        // loadPageElements 후 중복 제거 (서버에서 로드한 요소 중복 방지)
        // loadPageElements 내부에서 이미 중복 제거를 했지만, 추가로 확인
        const serverElementsMap = new Map();
        const serverElements = [];
        this.core.state.elements.forEach(el => {
            if (!el || (!el.id && !el.elementType)) return;
            
            // ID와 좌표를 키로 사용하여 중복 제거
            const elementKey = el.id 
                ? `${el.id}_${el.xCoordinate}_${el.yCoordinate}` 
                : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
            
            if (!serverElementsMap.has(elementKey)) {
                serverElementsMap.set(elementKey, el);
                serverElements.push(el);
            } else {
                console.warn(`⚠️ 중복 요소 제거 (switchPage - loadPageElements 후): ${elementKey}`);
            }
        });
        this.core.state.elements = serverElements;
        console.log(`📥 서버 요소 중복 제거 후: ${this.core.state.elements.length}개`);
        
        // 서버에서 로드한 요소의 ID와 좌표 정보를 Map으로 저장 (중복 체크 강화)
        const serverElementMap = new Map(); // ID + 좌표로 키 생성
        const serverElementIdSet = new Set(); // ID만 저장
        const serverElementCoordSet = new Set(); // 좌표만 저장 (타입 + 좌표) - 모든 서버 요소 포함
        this.core.state.elements.forEach(el => {
            if (!el || (!el.id && !el.elementType)) return;
            
            // 좌표 기반 중복 체크를 위해 모든 서버 요소의 좌표를 저장
            const coordKey = `${el.elementType || 'unknown'}_${el.xCoordinate}_${el.yCoordinate}`;
            serverElementCoordSet.add(coordKey);
            
            // ID가 있고 임시 ID가 아닌 경우에만 ID 기반 맵에 추가
            // element_로 시작하는 ID도 서버에서 로드한 요소일 수 있으므로 포함
            if (el.id && !el.id.toString().startsWith('temp')) {
                const elementId = el.id.toString();
                const key = `${elementId}_${el.xCoordinate}_${el.yCoordinate}`;
                serverElementIdSet.add(elementId);
                serverElementMap.set(key, el);
            }
        });
        
        // 저장된 로컬 요소 복원 (있는 경우)
        // 저장 후에는 localElementsByPage가 초기화되므로, 저장되지 않은 작업만 복원
        // 로컬 변경사항(이동, 삭제)을 우선시해야 함
        // localElementsByPage[pageNumber]가 존재하면 (빈 배열이어도) 로컬 상태를 우선시
        if (this.localElementsByPage.hasOwnProperty(pageNumber)) {
            const savedLocalElements = this.localElementsByPage[pageNumber];
            
            // 빈 배열인 경우 (모든 요소가 삭제된 경우) 서버 요소를 무시하고 빈 배열로 설정
            if (savedLocalElements.length === 0) {
                console.log(`🗑️ 페이지 ${pageNumber}의 모든 요소가 삭제됨 (로컬 상태 유지)`);
                this.core.state.elements = [];
                this.core.markDirty();
                this.core.render && this.core.render();
                this.updatePageDisplay();
                if (this.modeManager && typeof this.modeManager.onPageSwitch === 'function') {
                    this.modeManager.onPageSwitch(pageNumber);
                }
                console.log(`📄 페이지 전환: ${pageNumber} (최대: ${this.maxPage})`);
                return;
            }
            
            // 깊은 복사로 복원
            const restoredElements = JSON.parse(JSON.stringify(savedLocalElements));
            
            // 로컬 요소의 ID 목록 생성 (삭제된 요소 확인용)
            const localElementIds = new Set();
            const localElementsById = new Map(); // ID -> 로컬 요소 (빠른 조회용)
            restoredElements.forEach(el => {
                if (!el || (!el.id && !el.elementType)) return;
                const elementId = el.id ? el.id.toString() : null;
                if (elementId && !elementId.startsWith('temp')) {
                    localElementIds.add(elementId);
                    localElementsById.set(elementId, el);
                }
            });
            
            // 최종 요소 목록 구성: 로컬 변경사항 우선
            // 로컬 요소 목록이 "진실의 원천"이 되므로, 로컬에 있는 요소만 사용
            // 로컬에 없는 서버 요소는 삭제된 것으로 간주하여 추가하지 않음
            const finalElements = [];
            const addedElementIds = new Set(); // 추가된 요소 ID 추적
            const addedCoords = new Set(); // 추가된 좌표 추적 (중복 방지)
            
            // 1단계: 로컬 요소 추가 (로컬 요소가 우선)
            // 로컬에 저장된 요소만 사용하고, 서버 요소는 로컬에 있는 것만 참고
            restoredElements.forEach(localEl => {
                if (!localEl || (!localEl.id && !localEl.elementType)) return;
                
                const elementId = localEl.id ? localEl.id.toString() : null;
                const coordKey = `${localEl.elementType || 'unknown'}_${localEl.xCoordinate}_${localEl.yCoordinate}`;
                
                // 좌표 기반 중복 체크
                if (addedCoords.has(coordKey)) {
                    console.warn(`⚠️ 로컬 요소 좌표 중복 제외 (switchPage): ${coordKey}`);
                    return;
                }
                
                addedCoords.add(coordKey);
                if (elementId && !elementId.startsWith('temp')) {
                    addedElementIds.add(elementId);
                }
                finalElements.push(localEl);
                console.log(`✅ 로컬 요소 추가: ${elementId || 'temp'} (로컬 변경사항 반영)`);
            });
            
            // 2단계: 서버 요소는 로컬에 있는 요소만 참고 (이미 1단계에서 로컬 요소를 모두 추가했으므로 서버 요소는 추가하지 않음)
            // 로컬 요소 목록이 "진실의 원천"이므로, 로컬에 없는 서버 요소는 삭제된 것으로 간주
            // 서버 요소는 로컬 요소의 최신 상태를 확인하는 용도로만 사용 (이미 로컬 요소에 반영됨)
            
            // 최종 요소 목록으로 교체
            this.core.state.elements = finalElements;
            console.log(`📂 페이지 ${pageNumber}의 로컬 요소 복원 완료: 총 ${finalElements.length}개 (로컬 변경사항 반영)`);
        }
        
        // 현재 페이지의 요소만 필터링 (pageNumber 확인)
        // 중복 방지: 같은 ID와 좌표를 가진 요소가 여러 개 있으면 하나만 유지
        const seenElementKeys = new Set(); // ID + 좌표
        const seenCoords = new Set(); // 타입 + 좌표 (임시 ID와 실제 ID가 다른 경우 대비)
        this.core.state.elements = this.core.state.elements.filter(el => {
            if (!el || (!el.id && !el.elementType)) return false;
            
            const elPage = el.pageNumber || pageNumber;
            const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
            
            // 현재 페이지와 일치하는 요소만 포함
            if (normalizedPage === pageNumber) {
                // 좌표 기반 중복 체크 (임시 ID와 실제 ID가 다른 경우 대비)
                const coordKey = `${el.elementType || 'unknown'}_${el.xCoordinate}_${el.yCoordinate}`;
                if (seenCoords.has(coordKey)) {
                    console.warn(`⚠️ 좌표 기반 중복 요소 제거 (switchPage - 최종 필터링): ${coordKey}`);
                    return false;
                }
                seenCoords.add(coordKey);
                
                // 중복 체크: ID와 좌표를 모두 확인하여 완전히 동일한 요소 제거
                const elementKey = el.id 
                    ? `${el.id}_${el.xCoordinate}_${el.yCoordinate}` 
                    : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                
                if (seenElementKeys.has(elementKey)) {
                    console.warn(`⚠️ ID+좌표 기반 중복 요소 제거 (switchPage - 최종 필터링): ${elementKey}`);
                    return false;
                }
                seenElementKeys.add(elementKey);
                return true;
            }
            return false;
        });
        
        console.log(`📄 페이지 ${pageNumber} 필터링 완료: ${this.core.state.elements.length}개 요소`);
        
        // 페이지 정보 업데이트 (maxPage 포함)
        this.updatePageDisplay();
        console.log(`📄 페이지 정보 업데이트: ${this.currentPage} / ${this.maxPage}`);
        
        // 캔버스 재렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
        
        // 모드별 추가 처리
        if (this.modeManager && typeof this.modeManager.onPageSwitch === 'function') {
            await this.modeManager.onPageSwitch(pageNumber);
            
            // 무선AP 설계 모드인 경우 초기 AP 위치 상태는 onPageSwitch 내부에서 저장됨
            // (renderWirelessAps 완료 후 저장하도록 변경)
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
            // 먼저 서버에서 실제 maxPage를 조회
            let serverMaxPage = this.maxPage;
            try {
                const maxPageResponse = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=1`);
                if (maxPageResponse.ok) {
                    const maxPageData = await maxPageResponse.json();
                    const maxPageValue = parseInt(maxPageData.maxPage, 10);
                    if (maxPageData.success && !isNaN(maxPageValue) && maxPageValue > 0) {
                        serverMaxPage = maxPageValue;
                        console.log(`📄 cleanupEmptyPages: 서버에서 maxPage 조회: ${serverMaxPage} (원본: ${maxPageData.maxPage}, 타입: ${typeof maxPageData.maxPage})`);
                    }
                }
            } catch (error) {
                console.warn('cleanupEmptyPages: maxPage 조회 실패:', error);
            }
            
            // 서버에서 모든 페이지의 요소 개수 확인
            const pagesWithElements = new Set();
            let maxPageWithElements = 0;
            
            // 1부터 서버 maxPage까지 각 페이지의 요소 확인
            for (let pageNum = 1; pageNum <= serverMaxPage; pageNum++) {
                try {
                    const response = await fetch(`/floorplan/api/elements?schoolId=${this.currentSchoolId}&pageNumber=${pageNum}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.elements && data.elements.length > 0) {
                            pagesWithElements.add(pageNum);
                            maxPageWithElements = Math.max(maxPageWithElements, pageNum);
                        } else {
                            // 빈 페이지: 1페이지는 항상 유지 (최소 1개 페이지 필요)
                            if (pageNum === 1) {
                                console.log(`📄 페이지 1은 항상 유지 (최소 1개 페이지 필요)`);
                                pagesWithElements.add(1);
                                maxPageWithElements = Math.max(maxPageWithElements, 1);
                            } else {
                                // 1페이지가 아닌 빈 페이지만 삭제
                                console.log(`🗑️ 빈 페이지 ${pageNum} 삭제`);
                                const deleteResponse = await fetch(`/floorplan/api/elements/delete-page?schoolId=${this.currentSchoolId}&pageNumber=${pageNum}`, {
                                    method: 'DELETE'
                                });
                                if (deleteResponse.ok) {
                                    console.log(`✅ 빈 페이지 ${pageNum} 삭제 완료`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`페이지 ${pageNum} 확인 오류:`, error);
                }
            }
            
            // maxPage 업데이트 (실제 요소가 있는 최대 페이지 번호, 최소 1)
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
            console.log(`📄 cleanupEmptyPages: maxPage 업데이트: ${this.maxPage}`);
            
            // 페이지 정보 업데이트
            this.updatePageDisplay();
            console.log(`📄 cleanupEmptyPages 완료: maxPage = ${this.maxPage}, currentPage = ${this.currentPage}`);
            
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
                    
                    // 중복 제거: ID와 좌표를 모두 확인하여 완전히 동일한 요소 제거
                    const uniqueElementsMap = new Map(); // ID + 좌표
                    const seenCoords = new Set(); // 타입 + 좌표 (임시 ID와 실제 ID가 다른 경우 대비)
                    elements.forEach(el => {
                        if (!el || (!el.id && !el.elementType)) return;
                        
                        // 좌표 기반 중복 체크 (임시 ID와 실제 ID가 다른 경우 대비)
                        const coordKey = `${el.elementType || 'unknown'}_${el.xCoordinate}_${el.yCoordinate}`;
                        if (seenCoords.has(coordKey)) {
                            console.warn(`⚠️ 좌표 기반 중복 요소 제거 (loadPageElements): ${coordKey}`);
                            return; // 이미 같은 좌표에 요소가 있으면 제외
                        }
                        seenCoords.add(coordKey);
                        
                        // ID와 좌표를 모두 포함한 키로 중복 체크 (더 정확한 중복 방지)
                        // element_로 시작하는 ID도 서버에서 로드한 요소일 수 있으므로 ID를 사용
                        const elementKey = el.id && !el.id.toString().startsWith('temp')
                            ? `${el.id}_${el.xCoordinate}_${el.yCoordinate}`
                            : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
                        
                        if (!uniqueElementsMap.has(elementKey)) {
                            uniqueElementsMap.set(elementKey, el);
                        } else {
                            console.warn(`⚠️ ID+좌표 기반 중복 요소 제거 (loadPageElements): ${elementKey}`);
                        }
                    });
                    
                    this.core.state.elements = Array.from(uniqueElementsMap.values());
                    console.log(`📥 페이지 ${pageNumber} 로드: 서버 ${elements.length}개 → 중복 제거 후 ${this.core.state.elements.length}개`);
                    
                    // 페이지를 처음 로드했을 때 초기 상태를 저장 (변경사항 감지용)
                    if (!this.lastSavedStateByPage[pageNumber]) {
                        const loadedElements = this.core.state.elements.filter(el => {
                            const elPage = el.pageNumber || pageNumber;
                            return elPage === pageNumber;
                        });
                        
                        // 무선AP 설계 모드에서는 AP/MDF 요소 제외
                        const elementsForComparison = loadedElements.filter(el => {
                            if (this.currentMode === 'design-wireless') {
                                if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                                    return false;
                                }
                            }
                            return true;
                        });
                        
                        // 요소 목록 저장 (추가/삭제 감지용, AP/MDF 제외)
                        const elementList = elementsForComparison.map(el => ({
                            id: el.id,
                            type: el.elementType,
                            name: el.name || el.label || '이름 없음',
                            x: el.xCoordinate,
                            y: el.yCoordinate,
                            w: el.width,
                            h: el.height
                        }));
                        
                        const elementHash = JSON.stringify(elementsForComparison.map(el => ({
                            id: el.id,
                            type: el.elementType,
                            x: el.xCoordinate,
                            y: el.yCoordinate,
                            w: el.width,
                            h: el.height
                        })).sort((a, b) => (a.id || '').toString().localeCompare((b.id || '').toString())));
                        
                        this.lastSavedStateByPage[pageNumber] = {
                            elementCount: elementsForComparison.length,
                            elementHash: elementHash,
                            elementList: elementList
                        };
                        
                        // localElementsByPage에도 초기 상태 저장 (AP/MDF 제외)
                        this.localElementsByPage[pageNumber] = JSON.parse(JSON.stringify(elementsForComparison));
                        
                        // 무선AP 설계 모드인 경우 초기 AP 위치 상태는 onPageSwitch에서 저장됨
                        // (해당 페이지의 AP만 저장하도록 처리)
                        
                        console.log(`💾 페이지 ${pageNumber}의 초기 상태 저장 (loadPageElements, 변경사항 감지용, AP/MDF 제외)`);
                    }
                    
                    // 최대 페이지 번호 업데이트 (서버에서 받은 값으로 설정)
                    // 주의: 이미 클라이언트에서 더 큰 maxPage를 가지고 있을 수 있으므로, 절대 감소시키지 않음
                    const maxPageValue = parseInt(data.maxPage, 10);
                    if (!isNaN(maxPageValue) && maxPageValue > 0) {
                        const oldMaxPage = this.maxPage;
                        this.maxPage = Math.max(this.maxPage, maxPageValue);
                        console.log(`📄 maxPage 업데이트 (loadPageElements): ${this.maxPage} (원본: ${data.maxPage}, 기존: ${oldMaxPage}, 타입: ${typeof data.maxPage})`);
                    } else {
                        // 서버에서 maxPage를 제공하지 않으면 현재 값 유지
                        console.log(`📄 maxPage 유지 (loadPageElements): ${this.maxPage} (서버에서 제공하지 않음: ${data.maxPage}, 타입: ${typeof data.maxPage})`);
                    }
                    
                    this.core.markDirty();
                    this.core.render && this.core.render();
                    
                    return { success: true, maxPage: this.maxPage };
                } else {
                    // elements가 없어도 maxPage는 업데이트
                    // 단, 이미 클라이언트가 더 큰 maxPage를 알고 있다면 줄이지 않음
                    const maxPageValue = parseInt(data.maxPage, 10);
                    if (!isNaN(maxPageValue) && maxPageValue > 0) {
                        const oldMaxPage = this.maxPage;
                        this.maxPage = Math.max(this.maxPage, maxPageValue);
                        console.log(`📄 maxPage 업데이트 (loadPageElements - 요소 없음): ${this.maxPage} (원본: ${data.maxPage}, 기존: ${oldMaxPage}, 타입: ${typeof data.maxPage})`);
                    }
                    this.core.state.elements = [];
                    this.core.markDirty();
                    this.core.render && this.core.render();
                    return { success: true, maxPage: this.maxPage };
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

