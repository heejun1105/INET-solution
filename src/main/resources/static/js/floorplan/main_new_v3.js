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
        
        // Core에 schoolId 저장
        this.core.currentSchoolId = null;
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
            const result = await this.dataSyncManager.load(schoolId);
            
            if (result.success) {
                console.log('✅ 평면도 로드 완료');
                
                // 첫 로드 시에만 모든 요소가 보이도록 자동 피팅
                // (이미 로드된 상태에서 다시 로드할 때는 이전 시점 유지)
                if (this.core.state.elements.length === 0 || this.isFirstEntry) {
                    this.core.fitToElements();
                }
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
            } else {
                console.log('ℹ️ 저장된 평면도 없음');
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
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
            window.location.href = `/floorplan/export/ppt?schoolId=${this.currentSchoolId}&mode=${mode}`;
            
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
            // 1. 교실 좌표 저장 (교실 설계 모드인 경우)
            let classroomSaveFailed = false;
            if (this.currentMode === 'design-classroom' && this.modeManager) {
                const classroomSaveResult = await this.saveClassroomCoordinates();
                if (classroomSaveResult === false) {
                    classroomSaveFailed = true;
                }
            }
            
            // 2. 평면도 데이터 저장 (알림은 여기서 통합 표시)
            const result = await this.dataSyncManager.save(this.currentSchoolId, false); // 내부 알림 비활성화
            
            console.log('💾 평면도 저장 결과:', result);
            
            // result가 객체인 경우와 boolean인 경우 모두 처리
            if (result === true || (result && result.success === true)) {
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
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.floorPlanApp = new FloorPlanApp();
    window.floorPlanApp.init();
});

export default FloorPlanApp;

