import SnapManager from './SnapManager.js';
import InfiniteCanvasManager from './InfiniteCanvasManager.js';
import PanManager from './PanManager.js';
import AutoExpandManager from './AutoExpandManager.js';
import DragPreviewManager from './DragPreviewManager.js';
import CanvasRenderer from './CanvasRenderer.js';

export default class DesignModeManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDesignMode = false;
        this.originalUI = null;
        this.hasUnsavedChanges = false;
        this.designToolbar = null;
        this.contextMenu = null;
        this.gridSnapManager = null;
        this.keyboardShortcuts = new Map();
        
        // 변경사항 감지를 위한 원본 데이터
        this.originalData = null;
        
        // 무한 캔버스 시스템
        this.infiniteCanvasManager = null;
        this.panManager = null;
        this.autoExpandManager = null;
        this.dragPreviewManager = null;
        this.canvasRenderer = null;
        this.canvasContainer = null;
        this.originalCanvas = null; // 원래 캔버스 저장용
        
        this.init();
    }
    
    init() {
        this.setupKeyboardShortcuts();
        this.setupGridSnap();
        this.setupContextMenu();
        this.setupChangeDetection();
        // 키보드 단축키를 바로 활성화 (도움말 단축키를 위해)
        this.enableKeyboardShortcuts();
    }
    
    /**
     * 설계 모드 진입
     */
    enterDesignMode() {
        if (this.isDesignMode) return;
        
        console.log('🎨 설계 모드 진입');
        
        // 0. 원래 캔버스 저장 (복원용)
        this.originalCanvas = this.floorPlanManager.canvas;
        console.log('💾 원래 캔버스 저장:', this.originalCanvas);
        
        // 1. 현재 UI 상태 저장
        this.saveOriginalUI();
        
        // 2. 변경사항 감지를 위한 원본 데이터 저장
        this.saveOriginalData();
        
        // 3. 전체화면 모드로 전환
        this.showFullscreenMode();
        
        // 4. 무한 캔버스 시스템 초기화
        this.initializeInfiniteCanvas();
        
        // 5. 전용 도구 모음 표시
        this.showDesignToolbar();
        
        // 6. 그리드 스냅 활성화
        this.enableGridSnap();
        
        // 7. 키보드 단축키 활성화
        this.enableKeyboardShortcuts();
        
        // 8. 페이지 이탈 방지
        this.setupPageLeaveWarning();
        
        this.isDesignMode = true;
        this.hasUnsavedChanges = false;
        
        // 9. 캔버스 중앙 정렬 (약간의 지연 후)
        setTimeout(() => {
            if (this.infiniteCanvasManager) {
                this.infiniteCanvasManager.centerView();
                console.log('🎯 캔버스 중앙 정렬 완료');
            }
        }, 300);
        
        console.log('✅ 설계 모드 활성화 완료');
    }
    
    /**
     * 설계 모드 종료
     */
    exitDesignMode() {
        if (!this.isDesignMode) return;
        
        console.log('🚪 설계 모드 종료');
        
        // 1. 변경사항 확인
        if (this.hasUnsavedChanges) {
            const shouldSave = confirm('저장되지 않은 변경사항이 있습니다. 저장하시겠습니까?');
            if (shouldSave) {
                this.floorPlanManager.saveFloorPlan();
            }
        }
        
        // 2. 무한 캔버스 시스템 정리
        this.destroyInfiniteCanvas();
        
        // 3. 컨텍스트 메뉴 제거
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        
        // 3-1. 설계 도구 모음 제거
        if (this.designToolbar) {
            this.designToolbar.remove();
            this.designToolbar = null;
        }
        
        // 3-2. 그리드 오버레이 제거
        const gridOverlay = document.querySelector('.grid-overlay');
        if (gridOverlay) {
            gridOverlay.remove();
        }
        
        // 3-3. 도움말 모달 제거
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.remove();
        }
        
        // 4. 원본 UI 복원
        this.restoreOriginalUI();
        
        // 5. main.js의 exitDesignMode 함수 호출
        if (window.exitDesignMode && typeof window.exitDesignMode === 'function') {
            window.exitDesignMode();
        }
        
        // 6. 키보드 단축키 비활성화
        this.disableKeyboardShortcuts();
        
        // 7. 페이지 이탈 경고 제거
        this.removePageLeaveWarning();
        
        this.isDesignMode = false;
        this.hasUnsavedChanges = false;
        
        console.log('✅ 설계 모드 종료 완료');
    }
    
    /**
     * 원본 UI 상태 저장
     */
    saveOriginalUI() {
        this.originalUI = {
            bodyClass: document.body.className,
            mainWrapper: document.querySelector('.main-wrapper')?.outerHTML,
            toolbar: document.querySelector('.toolbar')?.outerHTML,
            modeTabs: document.querySelector('.mode-tabs')?.outerHTML,
            schoolSelect: document.querySelector('.school-select')?.outerHTML
        };
    }
    
    /**
     * 원본 UI 복원
     */
    restoreOriginalUI() {
        if (!this.originalUI) return;
        
        // 전체화면 모드 해제
        document.body.classList.remove('design-mode-fullscreen');
        document.body.className = this.originalUI.bodyClass;
        
        // 캔버스를 원래 위치로 복원
        const fullscreenContainer = document.getElementById('fullscreenCanvasContainer');
        const canvas = document.getElementById('canvas');
        if (fullscreenContainer && canvas) {
            // 캔버스를 원래 위치로 이동
            fullscreenContainer.removeChild(canvas);
            fullscreenContainer.remove();
            
            // 캔버스를 원래 위치에 다시 추가 (뷰어 컨테이너에)
            const viewerContent = document.getElementById('viewerContent');
            if (viewerContent) {
                viewerContent.appendChild(canvas);
            }
        }
        
        // 설계모드 관련 요소들 완전 제거
        const designElements = document.querySelectorAll('.design-toolbar, .grid-overlay, .context-menu');
        designElements.forEach(element => {
            if (element && element.parentNode) {
                element.remove();
            }
        });
        
        // FloorPlanManager 재초기화
        this.floorPlanManager.init();
    }
    
    /**
     * 전체화면 모드 표시
     */
    showFullscreenMode() {
        document.body.classList.add('design-mode-fullscreen');
        
        // 전체화면 모드 CSS 추가
        this.addFullscreenStyles();
        
        // ⚠️ 기존 캔버스를 완전히 숨김 (충돌 방지)
        const oldCanvas = document.getElementById('canvas');
        if (oldCanvas) {
            oldCanvas.style.cssText = `
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                z-index: -9999 !important;
                pointer-events: none !important;
            `;
            console.log('👻 기존 캔버스 완전히 숨김');
        }
        
        // 무한 캔버스 시스템을 위한 컨테이너만 생성 (캔버스는 이동하지 않음!)
        const existingContainer = document.getElementById('fullscreenCanvasContainer');
        if (!existingContainer) {
            const canvasContainer = document.createElement('div');
            canvasContainer.id = 'fullscreenCanvasContainer';
            // ⚠️ 최상위 레벨 z-index (toolbar 아래)
            canvasContainer.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 9998 !important;
                background: white !important;
                overflow: hidden !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            `;
            document.body.appendChild(canvasContainer);
            console.log('✅ 전체화면 컨테이너 생성 완료 (z-index: 9998)');
        }
        
        // 도움말 모달 생성
        this.createHelpModal();
    }
    
    /**
     * 전용 도구 모음 표시
     */
    showDesignToolbar() {
        this.designToolbar = this.createDesignToolbar();
        document.body.appendChild(this.designToolbar);
        
        // 도구 모음 이벤트 바인딩
        this.bindDesignToolbarEvents();
    }
    
    /**
     * 전용 도구 모음 생성
     */
    createDesignToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'design-toolbar';
        toolbar.innerHTML = `
            <div class="design-toolbar-content">
                <!-- 좌측: 학교 선택 -->
                <div class="tool-group school-select-group">
                    <div class="school-select-container">
                        <label for="designSchoolSelect" class="school-select-label">
                            <i class="fas fa-school"></i>
                            학교 선택
                        </label>
                        <select id="designSchoolSelect" class="school-select">
                            <option value="">학교를 선택하세요</option>
                        </select>
                    </div>
                </div>
                
                <!-- 건물 및 교실 도구 -->
                <div class="tool-group">
                    <button class="design-tool-btn" data-tool="building" title="건물 추가">
                        <i class="fas fa-building"></i>
                    </button>
                    <button class="design-tool-btn" data-tool="room" title="교실 추가">
                        <i class="fas fa-door-open"></i>
                    </button>
                </div>
                
                <!-- 도형 도구 -->
                <div class="tool-group">
                    <div class="tool-dropdown">
                        <button class="design-tool-btn dropdown-btn" data-tool="shape" title="도형">
                            <i class="fas fa-shapes"></i>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item" data-shape="rectangle">사각형</button>
                            <button class="dropdown-item" data-shape="circle">원</button>
                            <button class="dropdown-item" data-shape="line">선</button>
                            <button class="dropdown-item" data-shape="arrow">화살표</button>
                        </div>
                    </div>
                </div>
                
                <!-- 기타공간 도구 -->
                <div class="tool-group">
                    <div class="tool-dropdown">
                        <button class="design-tool-btn dropdown-btn" data-tool="other-space" title="기타공간">
                            <i class="fas fa-square"></i>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item" data-other-space="corridor">복도</button>
                            <button class="dropdown-item" data-other-space="staircase">계단</button>
                            <button class="dropdown-item" data-other-space="elevator">엘리베이터</button>
                            <button class="dropdown-item" data-other-space="toilet">화장실</button>
                            <button class="dropdown-item" data-other-space="office">사무실</button>
                            <button class="dropdown-item" data-other-space="library">도서관</button>
                            <button class="dropdown-item" data-other-space="cafeteria">급식실</button>
                            <button class="dropdown-item" data-other-space="gym">체육관</button>
                            <button class="dropdown-item" data-other-space="auditorium">강당</button>
                        </div>
                    </div>
                </div>
                
                <!-- 스타일 도구 -->
                <div class="tool-group">
                    <select class="design-style-select" id="shapeColorSelect">
                        <option value="#000000">검정</option>
                        <option value="#ff0000">빨강</option>
                        <option value="#00ff00">초록</option>
                        <option value="#0000ff">파랑</option>
                        <option value="#ffff00">노랑</option>
                        <option value="#ff00ff">자홍</option>
                        <option value="#00ffff">청록</option>
                    </select>
                    
                    <select class="design-style-select" id="shapeThicknessSelect">
                        <option value="1">1px</option>
                        <option value="2" selected>2px</option>
                        <option value="3">3px</option>
                        <option value="4">4px</option>
                        <option value="5">5px</option>
                    </select>
                </div>
                
                <!-- 추가 기능 -->
                <div class="tool-group">
                    <div class="tool-dropdown">
                        <button class="design-tool-btn dropdown-btn" data-tool="additional-features" title="추가 기능">
                            <i class="fas fa-cog"></i>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item" data-action="reset-floorplan">
                                <i class="fas fa-undo"></i> 평면도 초기화
                            </button>
                            <button class="dropdown-item" data-action="match-classrooms">
                                <i class="fas fa-link"></i> 교실 매칭
                                <span class="info-icon">ⓘ</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 미배치 교실 드롭다운 -->
                <div class="tool-group">
                    <div class="tool-dropdown">
                        <button class="design-tool-btn dropdown-btn" data-tool="unplaced-classrooms" title="미배치 교실">
                            <i class="fas fa-list"></i>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="dropdown-menu" id="unplacedClassroomsDropdown">
                            <div class="dropdown-header">미배치 교실</div>
                            <div id="unplacedClassroomsList" class="unplaced-classrooms-list">
                                <!-- 미배치 교실 목록이 동적으로 추가됨 -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 줌 도구 -->
                <div class="tool-group">
                    <button class="design-tool-btn" data-tool="zoom-in" title="확대 (+)">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="design-tool-btn" data-tool="zoom-out" title="축소 (-)">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
                
                <!-- 우측: 모드 전환 및 저장 -->
                <div class="tool-group right-group">
                    <button class="design-tool-btn help-btn" data-tool="help" title="조작법 도움말 (H)">
                        <i class="fas fa-question-circle"></i> 도움말
                    </button>
                    <button class="design-tool-btn save-btn" data-tool="save" title="저장 (Ctrl+S)">
                        <i class="fas fa-save"></i> 저장
                    </button>
                    <button class="design-tool-btn ppt-btn" data-tool="ppt-download" title="PPT 다운로드" style="background: #10b981; border-color: #059669;">
                        <i class="fas fa-file-powerpoint"></i> PPT
                    </button>
                    <button class="design-tool-btn exit-btn" data-tool="exit" title="설계 모드 종료 (Esc)">
                        <i class="fas fa-times"></i> 종료
                    </button>
                </div>
            </div>
        `;
        
        return toolbar;
    }
    
    /**
     * 도움말 모달 생성
     */
    createHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'help-modal';
        modal.id = 'helpModal';
        modal.innerHTML = `
            <div class="help-modal-content">
                <div class="help-modal-header">
                    <h2>
                        <i class="fas fa-keyboard"></i>
                        조작법 안내
                    </h2>
                    <button class="help-modal-close" onclick="document.getElementById('helpModal').classList.remove('active')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-modal-body">
                    <div class="help-section">
                        <h3>
                            <i class="fas fa-hand-pointer"></i>
                            캔버스 이동 (팬)
                        </h3>
                        <div class="help-items">
                            <div class="help-item">
                                <div class="help-item-key">스페이스바 + 드래그</div>
                                <div class="help-item-description">캔버스를 상하좌우로 자유롭게 이동합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">마우스 휠 버튼 + 드래그</div>
                                <div class="help-item-description">마우스 가운데 버튼을 누른 채로 드래그하여 캔버스를 이동합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">Shift + 마우스 휠</div>
                                <div class="help-item-description">캔버스를 좌우로 빠르게 이동합니다.</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3>
                            <i class="fas fa-search-plus"></i>
                            확대/축소
                        </h3>
                        <div class="help-items">
                            <div class="help-item">
                                <div class="help-item-key">Ctrl/Cmd + 마우스 휠</div>
                                <div class="help-item-description">캔버스를 확대하거나 축소합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">+ / -</div>
                                <div class="help-item-description">툴바의 확대/축소 버튼 또는 키보드의 +/- 키로 조절합니다.</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3>
                            <i class="fas fa-mouse-pointer"></i>
                            요소 조작
                        </h3>
                        <div class="help-items">
                            <div class="help-item">
                                <div class="help-item-key">클릭 & 드래그</div>
                                <div class="help-item-description">교실, 건물, 도형을 선택하여 이동합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">모서리 드래그</div>
                                <div class="help-item-description">요소의 모서리를 드래그하여 크기를 조절합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">드래그 박스 선택</div>
                                <div class="help-item-description">빈 공간을 드래그하여 여러 요소를 한 번에 선택합니다.</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3>
                            <i class="fas fa-keyboard"></i>
                            단축키
                        </h3>
                        <div class="help-items">
                            <div class="help-item">
                                <div class="help-item-key">Ctrl/Cmd + A</div>
                                <div class="help-item-description">모든 요소를 선택합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">Delete / Backspace</div>
                                <div class="help-item-description">선택한 요소를 삭제합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">Esc</div>
                                <div class="help-item-description">선택을 해제하거나 설계 모드를 종료합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">Home</div>
                                <div class="help-item-description">캔버스를 화면 중앙으로 이동합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">Ctrl/Cmd + S</div>
                                <div class="help-item-description">현재 평면도를 저장합니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">H</div>
                                <div class="help-item-description">이 도움말을 표시합니다.</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="help-section">
                        <h3>
                            <i class="fas fa-magic"></i>
                            특수 기능
                        </h3>
                        <div class="help-items">
                            <div class="help-item">
                                <div class="help-item-key">자동 확장</div>
                                <div class="help-item-description">요소를 캔버스 가장자리로 드래그하면 자동으로 캔버스가 확장됩니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">자동 축소</div>
                                <div class="help-item-description">요소를 삭제하거나 이동하면 캔버스가 적절한 크기로 자동 축소됩니다.</div>
                            </div>
                            <div class="help-item">
                                <div class="help-item-key">미배치 교실</div>
                                <div class="help-item-description">툴바의 목록 아이콘을 클릭하여 미배치 교실을 드래그 앤 드롭으로 추가합니다.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    /**
     * 도움말 모달 표시
     */
    showHelpModal() {
        let modal = document.getElementById('helpModal');
        if (!modal) {
            // 모달이 없으면 생성
            this.createHelpModal();
            modal = document.getElementById('helpModal');
        }
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    /**
     * 전체화면 모드 CSS 스타일 추가
     */
    addFullscreenStyles() {
        const style = document.createElement('style');
        style.id = 'design-mode-styles';
        style.textContent = `
            .design-mode-fullscreen {
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            
            .design-mode-fullscreen * {
                box-sizing: border-box;
            }
            
            .design-toolbar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                border-bottom: 2px solid #475569;
                z-index: 10000 !important;
                display: flex;
                align-items: center;
                padding: 0 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .design-toolbar-content {
                display: flex;
                align-items: center;
                width: 100%;
                gap: 20px;
            }
            
            .tool-group {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 0 12px;
                border-right: 1px solid #475569;
            }
            
            .tool-group:last-child {
                border-right: none;
                margin-left: auto;
            }
            
            .school-select-group {
                border-right: 1px solid #475569;
                padding: 0 16px;
                min-width: 200px;
            }
            
            .school-select-container {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .school-select-label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                font-weight: 600;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .school-select-label i {
                font-size: 10px;
            }
            
            .school-select {
                background: #374151;
                border: 1px solid #475569;
                color: #e2e8f0;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 13px;
                min-width: 160px;
                cursor: pointer;
                transition: border-color 0.2s ease;
            }
            
            .school-select:focus {
                outline: none;
                border-color: #3b82f6;
            }
            
            .school-select:hover {
                border-color: #64748b;
            }
            
            .design-tool-btn {
                background: transparent;
                border: 1px solid #475569;
                color: #e2e8f0;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                min-width: 40px;
                justify-content: center;
            }
            
            .design-tool-btn:hover {
                background: #475569;
                border-color: #64748b;
                color: white;
            }
            
            .design-tool-btn.active {
                background: #3b82f6;
                border-color: #2563eb;
                color: white;
            }
            
            .design-tool-btn.dropdown-btn {
                position: relative;
            }
            
            .dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                background: #1e293b;
                border: 1px solid #475569;
                border-radius: 6px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                z-index: 1002;
                min-width: 160px;
                display: none;
                margin-top: 4px;
            }
            
            .dropdown-menu.show {
                display: block;
            }
            
            .dropdown-item {
                background: transparent;
                border: none;
                color: #e2e8f0;
                padding: 10px 16px;
                width: 100%;
                text-align: left;
                cursor: pointer;
                transition: background 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .dropdown-item:hover {
                background: #475569;
            }
            
            .design-style-select {
                background: #374151;
                border: 1px solid #475569;
                color: #e2e8f0;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
                min-width: 60px;
                cursor: pointer;
            }
            
            .design-style-select:focus {
                outline: none;
                border-color: #3b82f6;
            }
            
            .info-icon {
                margin-left: auto;
                font-size: 12px;
                opacity: 0.7;
            }
            
            .dropdown-header {
                padding: 8px 12px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                font-size: 12px;
                font-weight: 600;
                color: #64748b;
                text-align: center;
            }
            
            .unplaced-classrooms-list {
                max-height: 200px;
                overflow-y: auto;
                padding: 4px 0;
            }
            
            .unplaced-classroom-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                cursor: pointer;
                transition: background 0.2s ease;
                border-bottom: 1px solid #f1f5f9;
            }
            
            .unplaced-classroom-item:hover {
                background: #f8fafc;
            }
            
            .unplaced-classroom-item:last-child {
                border-bottom: none;
            }
            
            .unplaced-classroom-item .classroom-name {
                font-size: 13px;
                font-weight: 500;
                color: #374151;
                flex: 1;
            }
            
            .unplaced-classroom-item .drag-icon {
                color: #9ca3af;
                font-size: 12px;
                margin-left: 8px;
            }
            
            .no-unplaced-classrooms {
                padding: 16px 12px;
                text-align: center;
                color: #9ca3af;
                font-size: 12px;
            }
            
            .dropdown-item:first-child {
                border-radius: 6px 6px 0 0;
            }
            
            .dropdown-item:last-child {
                border-radius: 0 0 6px 6px;
            }
            
            .save-btn {
                background: #10b981;
                border-color: #059669;
            }
            
            .save-btn:hover {
                background: #059669;
            }
            
            .ppt-btn {
                background: #10b981;
                border-color: #059669;
            }
            
            .ppt-btn:hover {
                background: #059669;
            }
            
            .exit-btn {
                background: #ef4444;
                border-color: #dc2626;
            }
            
            .exit-btn:hover {
                background: #dc2626;
            }
            
            .help-btn {
                background: #3b82f6;
                border-color: #2563eb;
            }
            
            .help-btn:hover {
                background: #2563eb;
            }
            
            .right-group {
                border-left: 1px solid #475569;
                padding-left: 20px;
            }
            
            /* 도움말 모달 */
            .help-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                animation: fadeIn 0.2s ease;
            }
            
            .help-modal.active {
                display: flex;
            }
            
            .help-modal-content {
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                animation: slideIn 0.3s ease;
            }
            
            .help-modal-header {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
                padding: 24px 32px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .help-modal-header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .help-modal-close {
                background: none;
                border: none;
                color: #ffffff;
                font-size: 24px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
            }
            
            .help-modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .help-modal-body {
                padding: 32px;
            }
            
            .help-section {
                margin-bottom: 32px;
            }
            
            .help-section:last-child {
                margin-bottom: 0;
            }
            
            .help-section h3 {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                margin: 0 0 16px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .help-section h3 i {
                color: #3b82f6;
                font-size: 20px;
            }
            
            .help-items {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .help-item {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding: 12px;
                background: #f8fafc;
                border-radius: 8px;
                border-left: 3px solid #3b82f6;
            }
            
            .help-item-key {
                background: #1e293b;
                color: #ffffff;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                font-family: 'Courier New', monospace;
                white-space: nowrap;
                min-width: 120px;
                text-align: center;
            }
            
            .help-item-description {
                flex: 1;
                color: #475569;
                font-size: 14px;
                line-height: 1.6;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from { 
                    transform: translateY(-30px);
                    opacity: 0;
                }
                to { 
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            /* 그리드 스타일 */
            .grid-overlay {
                position: fixed;
                top: 60px;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
                background-size: 20px 20px;
                pointer-events: none;
                z-index: 999;
                display: none;
            }
            
            .grid-overlay.visible {
                display: block;
            }
            
            /* 컨텍스트 메뉴 */
            .context-menu {
                position: fixed;
                background: #1e293b;
                border: 1px solid #475569;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                z-index: 1003;
                min-width: 180px;
                display: none;
                padding: 8px 0;
            }
            
            .context-menu-item {
                background: transparent;
                border: none;
                color: #e2e8f0;
                padding: 10px 16px;
                width: 100%;
                text-align: left;
                cursor: pointer;
                transition: background 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .context-menu-item:hover {
                background: #475569;
            }
            
            .context-menu-item.disabled {
                color: #64748b;
                cursor: not-allowed;
            }
            
            .context-menu-item.disabled:hover {
                background: transparent;
            }
            
            .context-menu-separator {
                height: 1px;
                background: #475569;
                margin: 4px 0;
            }
            
            /* 크기 조절 핸들 스타일 - 기본적으로 완전히 숨김 */
            .resize-handles {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                display: none !important; /* 강제로 숨김 */
                opacity: 0; /* 투명도로도 숨김 */
                visibility: hidden; /* 시각적으로도 숨김 */
            }
            
            /* 선택된 요소에서만 핸들 표시 */
            .draggable.selected .resize-handles {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            .resize-handle {
                position: absolute;
                background: #3b82f6;
                border: 2px solid #ffffff;
                border-radius: 50%;
                width: 8px;
                height: 8px;
                pointer-events: all;
                cursor: pointer;
                z-index: 1001;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .resize-handle:hover {
                background: #2563eb;
                transform: scale(1.2);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            
            /* 8방향 핸들 위치 */
            .resize-handle.nw {
                top: -4px;
                left: -4px;
                cursor: nw-resize;
            }
            
            .resize-handle.ne {
                top: -4px;
                right: -4px;
                cursor: ne-resize;
            }
            
            .resize-handle.sw {
                bottom: -4px;
                left: -4px;
                cursor: sw-resize;
            }
            
            .resize-handle.se {
                bottom: -4px;
                right: -4px;
                cursor: se-resize;
            }
            
            .resize-handle.n {
                top: -4px;
                left: 50%;
                transform: translateX(-50%);
                cursor: n-resize;
            }
            
            .resize-handle.s {
                bottom: -4px;
                left: 50%;
                transform: translateX(-50%);
                cursor: s-resize;
            }
            
            .resize-handle.w {
                top: 50%;
                left: -4px;
                transform: translateY(-50%);
                cursor: w-resize;
            }
            
            .resize-handle.e {
                top: 50%;
                right: -4px;
                transform: translateY(-50%);
                cursor: e-resize;
            }
            
            /* 호버 시 핸들 확대 효과 */
            .resize-handle.n:hover,
            .resize-handle.s:hover,
            .resize-handle.w:hover,
            .resize-handle.e:hover {
                transform: scale(1.2);
            }
            
            .resize-handle.n:hover {
                transform: translateX(-50%) scale(1.2);
            }
            
            .resize-handle.s:hover {
                transform: translateX(-50%) scale(1.2);
            }
            
            .resize-handle.w:hover {
                transform: translateY(-50%) scale(1.2);
            }
            
            .resize-handle.e:hover {
                transform: translateY(-50%) scale(1.2);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 도구 모음 이벤트 바인딩
     */
    bindDesignToolbarEvents() {
        if (!this.designToolbar) return;
        
        // 기본 도구 버튼들
        this.designToolbar.querySelectorAll('.design-tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tool = btn.dataset.tool;
                this.handleToolClick(tool, btn);
            });
        });
        
        // 드롭다운 메뉴들
        this.designToolbar.querySelectorAll('.dropdown-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.nextElementSibling;
                this.toggleDropdown(dropdown);
            });
        });
        
        // 드롭다운 아이템들
        this.designToolbar.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tool = item.dataset.tool;
                const shape = item.dataset.shape;
                const otherSpace = item.dataset.otherSpace;
                const action = item.dataset.action;
                
                if (tool) {
                    this.handleToolClick(tool, item);
                } else if (shape) {
                    this.handleShapeClick(shape, item);
                } else if (otherSpace) {
                    this.handleOtherSpaceClick(otherSpace, item);
                } else if (action) {
                    this.handleActionClick(action, item);
                }
                
                this.closeAllDropdowns();
            });
        });
        
        // 스타일 선택 요소들
        this.designToolbar.querySelectorAll('.design-style-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleStyleChange(select.id, e.target.value);
            });
        });
        
        // 미배치 교실 드롭다운 이벤트
        this.setupUnplacedClassroomsDropdown();
        
        // 학교 선택 이벤트
        this.setupSchoolSelectEvents();
        
        // 외부 클릭 시 드롭다운 닫기
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });
    }
    
    /**
     * 도구 클릭 처리
     */
    handleToolClick(tool, element) {
        console.log('도구 클릭:', tool);
        
        switch (tool) {
            case 'building':
                this.floorPlanManager.selectTool('building');
                this.updateActiveTool(tool, element);
                break;
            case 'room':
                this.floorPlanManager.selectTool('room');
                this.updateActiveTool(tool, element);
                // 교실 생성 모드 활성화 - pendingClickCoords 설정
                this.floorPlanManager.pendingClickCoords = { x: 0, y: 0 }; // 더미 값, 실제 클릭 시 업데이트됨
                break;
            case 'shape':
                this.floorPlanManager.selectTool('shape');
                this.updateActiveTool(tool, element);
                break;
            case 'other-space':
                this.floorPlanManager.selectTool('other-space');
                this.updateActiveTool(tool, element);
                break;
            case 'additional-features':
                // 드롭다운 메뉴는 이미 처리됨
                break;
            case 'zoom-in':
                this.zoomIn();
                break;
            case 'zoom-out':
                this.zoomOut();
                break;
            case 'help':
                this.showHelpModal();
                break;
            case 'save':
                this.saveFloorPlanForCurrentSchool();
                this.hasUnsavedChanges = false;
                break;
            case 'ppt-download':
                this.downloadPPT();
                break;
            case 'exit':
                this.exitDesignMode();
                break;
        }
    }
    
    /**
     * 도형 클릭 처리
     */
    handleShapeClick(shape, element) {
        console.log('도형 선택:', shape);
        this.floorPlanManager.currentShapeType = shape;
        this.floorPlanManager.selectTool('shape');
        this.updateActiveTool('shape', element);
    }
    
    /**
     * 기타공간 클릭 처리
     */
    handleOtherSpaceClick(otherSpace, element) {
        console.log('기타공간 선택:', otherSpace);
        this.floorPlanManager.currentOtherSpaceType = otherSpace;
        this.floorPlanManager.selectTool('other-space');
        this.updateActiveTool('other-space', element);
    }
    
    /**
     * 액션 클릭 처리
     */
    handleActionClick(action, element) {
        console.log('액션 실행:', action);
        
        switch (action) {
            case 'reset-floorplan':
                this.resetFloorPlan();
                break;
            case 'match-classrooms':
                this.matchClassrooms();
                break;
        }
    }
    
    /**
     * 스타일 변경 처리
     */
    handleStyleChange(selectId, value) {
        console.log('스타일 변경:', selectId, value);
        
        switch (selectId) {
            case 'shapeColorSelect':
                this.floorPlanManager.currentShapeColor = value;
                break;
            case 'shapeThicknessSelect':
                this.floorPlanManager.currentShapeThickness = parseInt(value);
                break;
        }
    }
    
    /**
     * 평면도 초기화
     */
    resetFloorPlan() {
        if (confirm('평면도를 초기화하시겠습니까? 모든 데이터가 삭제됩니다.')) {
            this.floorPlanManager.clearCanvas();
            this.floorPlanManager.floorPlanData = {
                buildings: [],
                rooms: [],
                shapes: [],
                otherSpaces: [],
                wirelessApLocations: []
            };
            console.log('평면도 초기화 완료');
        }
    }
    
    /**
     * 학교 선택 이벤트 설정
     */
    setupSchoolSelectEvents() {
        const schoolSelect = this.designToolbar.querySelector('#designSchoolSelect');
        if (!schoolSelect) return;
        
        // 학교 목록 로드
        this.loadSchools();
        
        // 학교 선택 변경 이벤트
        schoolSelect.addEventListener('change', (e) => {
            const selectedSchoolId = e.target.value;
            console.log('학교 선택 변경:', selectedSchoolId);
            this.handleSchoolSelection(selectedSchoolId);
        });
    }
    
    /**
     * 학교 목록 로드
     */
    async loadSchools() {
        const schoolSelect = this.designToolbar.querySelector('#designSchoolSelect');
        if (!schoolSelect) {
            console.error('학교 선택 드롭다운을 찾을 수 없습니다');
            return;
        }
        
        console.log('학교 목록 로드 시작...');
        
        try {
            const response = await fetch('/school/api/schools', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'  // 쿠키 포함하여 인증 정보 전송
            });
            
            console.log('API 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('API 응답 실패:', response.status, response.statusText);
                throw new Error(`학교 목록을 가져올 수 없습니다. (${response.status})`);
            }
            
            const schools = await response.json();
            console.log('학교 목록 로드 성공:', schools);
            this.renderSchools(schools);
        } catch (error) {
            console.error('학교 목록 로드 실패:', error);
            schoolSelect.innerHTML = '<option value="">학교 목록을 불러올 수 없습니다</option>';
        }
    }
    
    /**
     * 학교 목록 렌더링
     */
    renderSchools(schools) {
        const schoolSelect = this.designToolbar.querySelector('#designSchoolSelect');
        if (!schoolSelect) {
            console.error('학교 선택 드롭다운을 찾을 수 없습니다');
            return;
        }
        
        console.log('학교 목록 렌더링 시작, schools:', schools);
        
        // 기존 옵션 제거
        schoolSelect.innerHTML = '<option value="">학교를 선택하세요</option>';
        
        // 학교 데이터 유효성 검사
        if (!schools || !Array.isArray(schools) || schools.length === 0) {
            console.warn('학교 목록이 비어있거나 유효하지 않습니다');
            schoolSelect.innerHTML = '<option value="">학교 목록이 없습니다</option>';
            return;
        }
        
        // 학교 옵션 추가 (데이터베이스 필드명에 맞춤)
        schools.forEach((school, index) => {
            console.log(`학교 ${index + 1}:`, school);
            
            if (!school.schoolId || !school.schoolName) {
                console.warn('유효하지 않은 학교 데이터:', school);
                return;
            }
            
            const option = document.createElement('option');
            option.value = school.schoolId;  // API 응답의 schoolId 필드 사용
            option.textContent = school.schoolName;  // API 응답의 schoolName 필드 사용
            schoolSelect.appendChild(option);
        });
        
        console.log('학교 목록 렌더링 완료, 총', schools.length, '개 학교');
    }
    
    /**
     * 학교 선택 처리
     */
    handleSchoolSelection(schoolId) {
        console.log('handleSchoolSelection 호출됨, schoolId:', schoolId, 'type:', typeof schoolId);
        
        if (!schoolId || schoolId === '' || schoolId === 'undefined') {
            // 학교가 선택되지 않은 경우
            console.log('학교가 선택되지 않음, 캔버스 초기화');
            this.floorPlanManager.currentSchoolId = null;
            this.clearCanvas();
            this.updateUnplacedClassroomsMessage('학교를 선택해주세요');
            return;
        }
        
        // 선택된 학교 ID 저장
        this.floorPlanManager.currentSchoolId = schoolId;
        console.log('currentSchoolId 설정됨:', this.floorPlanManager.currentSchoolId);
        
        // 해당 학교의 평면도 로드
        this.loadFloorPlanForSchool(schoolId);
        
        // 미배치 교실 목록 업데이트
        this.loadUnplacedClassrooms();
        
        console.log('학교 선택 완료:', schoolId);
    }
    
    /**
     * 학교별 평면도 로드
     */
    async loadFloorPlanForSchool(schoolId) {
        console.log('평면도 로드 시작, schoolId:', schoolId);
        
        try {
            // 해당 학교의 평면도 데이터 가져오기
            const url = `/floorplan/api/school/${schoolId}`;
            console.log('평면도 API 요청 URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'  // 쿠키 포함하여 인증 정보 전송
            });
            
            console.log('평면도 API 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('평면도 API 응답 실패:', response.status, response.statusText);
                throw new Error(`평면도를 불러올 수 없습니다. (${response.status})`);
            }
            
            const floorPlanData = await response.json();
            console.log('평면도 데이터 수신:', floorPlanData);
            
            // 데이터베이스 형식에 맞게 변환
            const convertedData = this.convertDatabaseToFloorPlanData(floorPlanData);
            console.log('변환된 평면도 데이터:', convertedData);
            
            this.floorPlanManager.floorPlanData = convertedData;
            this.floorPlanManager.renderFloorPlan();
            
            console.log('평면도 로드 완료:', schoolId);
        } catch (error) {
            console.error('평면도 로드 실패:', error);
            // 빈 평면도로 초기화
            this.floorPlanManager.floorPlanData = {
                buildings: [],
                rooms: [],
                shapes: [],
                otherSpaces: [],
                wirelessApLocations: []
            };
            this.floorPlanManager.renderFloorPlan();
        }
    }
    
    /**
     * 데이터베이스 평면도 데이터를 프론트엔드 형식으로 변환
     */
    convertDatabaseToFloorPlanData(dbData) {
        const convertedData = {
            buildings: [],
            rooms: [],
            shapes: [],
            otherSpaces: [],
            wirelessApLocations: []
        };
        
        // rooms 데이터 처리 (실제 API 응답 구조에 맞춤)
        if (dbData.rooms && Array.isArray(dbData.rooms)) {
            dbData.rooms.forEach(room => {
                // 이미 배치된 교실만 처리 (xCoordinate와 yCoordinate가 0이 아닌 경우)
                if (room.xCoordinate !== 0 || room.yCoordinate !== 0) {
                    convertedData.rooms.push({
                        id: room.classroomId,
                        classroomId: room.classroomId,
                        name: room.roomName,
                        x: room.xCoordinate,
                        y: room.yCoordinate,
                        width: room.width || 100,
                        height: room.height || 100,
                        zIndex: 1,
                        borderColor: '#000000',
                        borderThickness: '2'
                    });
                }
            });
        }
        
        // buildings 데이터 처리
        if (dbData.buildings && Array.isArray(dbData.buildings)) {
            dbData.buildings.forEach(building => {
                convertedData.buildings.push({
                    id: building.id,
                    name: building.name || '건물',
                    x: building.x || 0,
                    y: building.y || 0,
                    width: building.width || 200,
                    height: building.height || 200,
                    zIndex: 0
                });
            });
        }
        
        // wirelessAps 데이터 처리
        if (dbData.wirelessAps && Array.isArray(dbData.wirelessAps)) {
            dbData.wirelessAps.forEach(ap => {
                convertedData.wirelessApLocations.push({
                    id: ap.id,
                    name: ap.name || 'AP',
                    x: ap.x || 0,
                    y: ap.y || 0,
                    width: ap.width || 20,
                    height: ap.height || 20
                });
            });
        }
        
        return convertedData;
    }
    
    /**
     * 캔버스 초기화
     */
    clearCanvas() {
        if (this.floorPlanManager.canvas) {
            // div 요소인 경우 innerHTML 사용
            this.floorPlanManager.canvas.innerHTML = '';
        }
        this.floorPlanManager.floorPlanData = {
            buildings: [],
            rooms: [],
            shapes: [],
            otherSpaces: [],
            wirelessApLocations: []
        };
    }
    
    /**
     * 현재 학교의 평면도 저장
     */
    async saveFloorPlanForCurrentSchool() {
        if (!this.floorPlanManager.currentSchoolId) {
            alert('학교를 먼저 선택해주세요.');
            return;
        }
        
        try {
            // 프론트엔드 데이터를 데이터베이스 형식으로 변환
            const dbData = this.convertFloorPlanDataToDatabase(this.floorPlanManager.floorPlanData);
            
            const response = await fetch('/floorplan/api/save', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',  // 쿠키 포함하여 인증 정보 전송
                body: JSON.stringify({
                    schoolId: this.floorPlanManager.currentSchoolId,
                    floorPlanData: dbData
                })
            });
            
            if (!response.ok) throw new Error('평면도 저장에 실패했습니다.');
            
            console.log('평면도 저장 완료:', this.floorPlanManager.currentSchoolId);
            alert('평면도가 성공적으로 저장되었습니다.');
        } catch (error) {
            console.error('평면도 저장 실패:', error);
            alert('평면도 저장에 실패했습니다.');
        }
    }
    
    /**
     * 프론트엔드 평면도 데이터를 데이터베이스 형식으로 변환
     */
    convertFloorPlanDataToDatabase(floorPlanData) {
        const elements = [];
        
        // 교실 데이터 변환
        floorPlanData.rooms.forEach(room => {
            elements.push({
                element_type: 'room',
                reference_id: room.classroomId,
                x_coordinate: room.x,
                y_coordinate: room.y,
                width: room.width,
                height: room.height,
                z_index: room.zIndex || 0,
                element_data: JSON.stringify({
                    elementType: 'room',
                    roomName: room.name,
                    classroomId: room.classroomId,
                    borderColor: room.borderColor || '#000000',
                    borderThickness: room.borderThickness || '2'
                })
            });
        });
        
        // 건물 데이터 변환
        floorPlanData.buildings.forEach(building => {
            elements.push({
                element_type: 'building',
                reference_id: null,
                x_coordinate: building.x,
                y_coordinate: building.y,
                width: building.width,
                height: building.height,
                z_index: building.zIndex || 0,
                element_data: JSON.stringify({
                    elementType: 'building',
                    buildingName: building.name
                })
            });
        });
        
        // 도형 데이터 변환
        floorPlanData.shapes.forEach(shape => {
            elements.push({
                element_type: 'shape',
                reference_id: null,
                x_coordinate: shape.x,
                y_coordinate: shape.y,
                width: shape.width,
                height: shape.height,
                z_index: shape.zIndex || 0,
                element_data: JSON.stringify({
                    elementType: 'shape',
                    shapeType: shape.type,
                    color: shape.color || '#000000',
                    thickness: shape.thickness || '2'
                })
            });
        });
        
        // 기타공간 데이터 변환
        floorPlanData.otherSpaces.forEach(space => {
            elements.push({
                element_type: 'other-space',
                reference_id: null,
                x_coordinate: space.x,
                y_coordinate: space.y,
                width: space.width,
                height: space.height,
                z_index: space.zIndex || 0,
                element_data: JSON.stringify({
                    elementType: 'other-space',
                    spaceType: space.type,
                    spaceName: space.name
                })
            });
        });
        
        return {
            elements: elements,
            canvas_width: 4000,
            canvas_height: 2500,
            zoom_level: 1,
            name: '평면도',
            description: '학교 평면도'
        };
    }
    updateUnplacedClassroomsMessage(message) {
        const listContainer = this.designToolbar.querySelector('#unplacedClassroomsList');
        if (listContainer) {
            listContainer.innerHTML = `<div class="no-unplaced-classrooms">${message}</div>`;
        }
    }
    setupUnplacedClassroomsDropdown() {
        const dropdown = this.designToolbar.querySelector('#unplacedClassroomsDropdown');
        if (!dropdown) return;
        
        // 미배치 교실 목록 로드
        this.loadUnplacedClassrooms();
        
        // 드롭다운 토글 이벤트
        const toggleBtn = this.designToolbar.querySelector('[data-tool="unplaced-classrooms"]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(dropdown);
            });
        }
    }
    
    /**
     * 미배치 교실 목록 로드
     */
    loadUnplacedClassrooms() {
        const listContainer = this.designToolbar.querySelector('#unplacedClassroomsList');
        if (!listContainer) {
            console.error('미배치 교실 목록 컨테이너를 찾을 수 없습니다');
            return;
        }
        
        console.log('미배치 교실 로드 시작, currentSchoolId:', this.floorPlanManager?.currentSchoolId);
        
        // 현재 학교의 미배치 교실 목록을 가져옴
        if (this.floorPlanManager && this.floorPlanManager.currentSchoolId) {
            this.fetchUnplacedClassrooms(this.floorPlanManager.currentSchoolId);
        } else {
            console.log('학교가 선택되지 않음, 미배치 교실 목록 초기화');
            listContainer.innerHTML = '<div class="no-unplaced-classrooms">학교를 선택해주세요</div>';
        }
    }
    
    /**
     * 미배치 교실 데이터 가져오기
     */
    async fetchUnplacedClassrooms(schoolId) {
        console.log('미배치 교실 API 요청 시작, schoolId:', schoolId);
        
        try {
            const url = `/classroom/api/school/${schoolId}/classrooms`;
            console.log('미배치 교실 API 요청 URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'  // 쿠키 포함하여 인증 정보 전송
            });
            
            console.log('미배치 교실 API 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('미배치 교실 API 응답 실패:', response.status, response.statusText);
                throw new Error(`교실 목록을 가져올 수 없습니다. (${response.status})`);
            }
            
            const classrooms = await response.json();
            console.log('미배치 교실 데이터 수신:', classrooms);
            this.renderUnplacedClassrooms(classrooms);
        } catch (error) {
            console.error('미배치 교실 로드 실패:', error);
            const listContainer = this.designToolbar.querySelector('#unplacedClassroomsList');
            if (listContainer) {
                listContainer.innerHTML = '<div class="no-unplaced-classrooms">교실 목록을 불러올 수 없습니다</div>';
            }
        }
    }
    
    /**
     * 미배치 교실 목록 렌더링
     */
    renderUnplacedClassrooms(classrooms) {
        const listContainer = this.designToolbar.querySelector('#unplacedClassroomsList');
        if (!listContainer) return;
        
        if (!classrooms || classrooms.length === 0) {
            listContainer.innerHTML = '<div class="no-unplaced-classrooms">미배치 교실이 없습니다</div>';
            return;
        }
        
        // 미배치된 교실만 필터링 (xCoordinate와 yCoordinate가 0인 교실)
        const unplacedClassrooms = classrooms.filter(classroom => 
            classroom.xCoordinate === 0 && classroom.yCoordinate === 0
        );
        
        if (unplacedClassrooms.length === 0) {
            listContainer.innerHTML = '<div class="no-unplaced-classrooms">미배치 교실이 없습니다</div>';
            return;
        }
        
        listContainer.innerHTML = unplacedClassrooms.map(classroom => `
            <div class="unplaced-classroom-item" data-classroom-id="${classroom.classroomId}" data-classroom-name="${classroom.roomName}">
                <span class="classroom-name">${classroom.roomName}</span>
                <i class="fas fa-grip-vertical drag-icon"></i>
            </div>
        `).join('');
        
        // 드래그 이벤트 설정
        this.setupClassroomDragEvents();
    }
    
    /**
     * 교실 드래그 이벤트 설정
     */
    setupClassroomDragEvents() {
        const classroomItems = this.designToolbar.querySelectorAll('.unplaced-classroom-item');
        classroomItems.forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const classroomId = item.dataset.classroomId;
                const classroomName = item.dataset.classroomName;
                
                // 드래그 시작
                this.startClassroomDrag(classroomId, classroomName, e);
            });
        });
    }
    
    /**
     * 교실 드래그 시작
     */
    startClassroomDrag(classroomId, classroomName, e) {
        // 드래그 중인 교실 정보 저장
        this.draggingClassroom = {
            id: classroomId,
            name: classroomName
        };
        
        // 캔버스에 드래그 오버 효과 추가
        const canvas = this.floorPlanManager.canvas;
        if (canvas) {
            canvas.classList.add('drag-over');
        }
        
        // 드래그 프리뷰 생성 (무한 캔버스 모드)
        if (this.dragPreviewManager) {
            this.dragPreviewManager.createPreview({
                type: 'classroom',
                name: classroomName,
                width: 100,
                height: 100
            });
        }
        
        // 이벤트 핸들러 바인딩 (한 번만 바인딩)
        if (!this.boundHandleClassroomDragMove) {
            this.boundHandleClassroomDragMove = this.handleClassroomDragMove.bind(this);
            this.boundHandleClassroomDragEnd = this.handleClassroomDragEnd.bind(this);
        }
        
        // 마우스 이벤트 리스너 추가
        document.addEventListener('mousemove', this.boundHandleClassroomDragMove);
        document.addEventListener('mouseup', this.boundHandleClassroomDragEnd);
        
        console.log('교실 드래그 시작:', classroomName);
    }
    
    /**
     * 교실 드래그 이동 처리
     */
    handleClassroomDragMove(e) {
        // 드래그 중인 교실이 없으면 무시
        if (!this.draggingClassroom) return;
        
        // 드래그 프리뷰 위치 업데이트 (무한 캔버스 모드)
        if (this.dragPreviewManager) {
            const snapToGrid = this.gridSnapManager && this.gridSnapManager.enabled;
            this.dragPreviewManager.updatePosition(e.clientX, e.clientY, {
                snapToGrid: snapToGrid,
                gridSize: 20
            });
        }
    }
    
    /**
     * 교실 드래그 종료 처리
     */
    handleClassroomDragEnd(e) {
        if (!this.draggingClassroom) return;
        
        // 캔버스 위에서 드롭되었는지 확인
        const canvas = this.floorPlanManager.canvas;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const isOverCanvas = (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            );
            
            if (isOverCanvas) {
                // 마우스 위치를 캔버스 좌표로 변환
                let x, y;
                
                // 통합된 좌표 변환 시스템 사용 (중복 변환 방지)
                const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
                x = canvasCoords.x;
                y = canvasCoords.y;
                
                // 그리드 스냅 적용
                if (this.gridSnapManager && this.gridSnapManager.enabled) {
                    const snapped = this.gridSnapManager.snapPosition(x, y);
                    x = snapped.x;
                    y = snapped.y;
                }
                
                // 교실 생성 (데이터베이스의 classroom_id와 room_name 사용)
                this.floorPlanManager.createRoom(x, y, this.draggingClassroom.name, this.draggingClassroom.id);
                
                console.log('교실 배치:', { name: this.draggingClassroom.name, x, y });
            }
            
            // 드래그 오버 효과 제거
            canvas.classList.remove('drag-over');
        }
        
        // 드래그 프리뷰 제거
        if (this.dragPreviewManager) {
            this.dragPreviewManager.removePreview();
        }
        
        // 이벤트 리스너 제거
        document.removeEventListener('mousemove', this.boundHandleClassroomDragMove);
        document.removeEventListener('mouseup', this.boundHandleClassroomDragEnd);
        
        // 드래그 중인 교실 정보 초기화
        this.draggingClassroom = null;
        
        console.log('교실 드래그 종료');
        
        // 미배치 교실 목록 업데이트 (드래그된 교실 제거)
        this.loadUnplacedClassrooms();
    }
    
    /**
     * 교실 매칭
     */
    matchClassrooms() {
        if (this.floorPlanManager.matchClassrooms) {
            this.floorPlanManager.matchClassrooms();
        } else {
            console.log('교실 매칭 기능을 사용할 수 없습니다.');
        }
    }
    
    /**
     * 활성 도구 업데이트
     */
    updateActiveTool(tool, element) {
        // 모든 도구 버튼 비활성화
        this.designToolbar.querySelectorAll('.design-tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 현재 도구 활성화
        if (element) {
            element.classList.add('active');
        }
    }
    
    /**
     * 드롭다운 토글
     */
    toggleDropdown(dropdown) {
        this.closeAllDropdowns();
        dropdown.classList.add('show');
    }
    
    /**
     * 모든 드롭다운 닫기
     */
    closeAllDropdowns() {
        this.designToolbar.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        this.keyboardShortcuts.set('KeyH', () => this.showHelpModal()); // 도움말
        this.keyboardShortcuts.set('Equal', () => this.handleToolClick('zoom-in')); // + 키
        this.keyboardShortcuts.set('Minus', () => this.handleToolClick('zoom-out')); // - 키
        this.keyboardShortcuts.set('Escape', () => this.exitDesignMode());
        this.keyboardShortcuts.set('Home', () => this.centerCanvas()); // Home 키로 캔버스 중앙 정렬
    }
    
    /**
     * 캔버스 중앙 정렬
     */
    centerCanvas() {
        if (this.infiniteCanvasManager) {
            this.infiniteCanvasManager.centerView();
            console.log('🎯 캔버스 중앙 정렬 (Home 키)');
        }
    }
    
    /**
     * 키보드 단축키 활성화
     */
    enableKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    /**
     * 키보드 단축키 비활성화
     */
    disableKeyboardShortcuts() {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    /**
     * 키보드 이벤트 처리
     */
    handleKeyDown(e) {
        // 도움말 단축키는 설계 모드 외부에서도 작동
        if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.showHelpModal();
            return;
        }
        
        if (!this.isDesignMode) return;
        
        // Ctrl/Cmd 조합 키
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'c':
                    e.preventDefault();
                    this.copySelectedElements();
                    break;
                case 'v':
                    e.preventDefault();
                    this.pasteElements();
                    break;
                case 's':
                    e.preventDefault();
                    this.floorPlanManager.saveFloorPlan();
                    this.hasUnsavedChanges = false;
                    break;
                case 'z':
                    e.preventDefault();
                    // 실행취소 기능 (추후 구현)
                    break;
                case 'y':
                    e.preventDefault();
                    // 다시실행 기능 (추후 구현)
                    break;
            }
            return;
        }
        
        // 단일 키 단축키
        const handler = this.keyboardShortcuts.get(e.code);
        if (handler) {
            e.preventDefault();
            handler();
        }
    }
    
    /**
     * 그리드 스냅 설정
     */
    setupGridSnap() {
        this.gridSnapManager = new SnapManager();
    }
    
    /**
     * 그리드 스냅 활성화
     */
    enableGridSnap() {
        if (this.gridSnapManager) {
            this.gridSnapManager.enableGridSnap(20); // 20px 그리드
        }
    }
    
    /**
     * 그리드 토글
     */
    toggleGrid() {
        const gridOverlay = document.querySelector('.grid-overlay');
        if (!gridOverlay) {
            this.createGridOverlay();
        } else {
            gridOverlay.classList.toggle('visible');
        }
    }
    
    /**
     * 그리드 오버레이 생성
     */
    createGridOverlay() {
        const gridOverlay = document.createElement('div');
        gridOverlay.className = 'grid-overlay visible';
        document.body.appendChild(gridOverlay);
    }
    
    /**
     * 컨텍스트 메뉴 설정
     */
    setupContextMenu() {
        // 설계모드가 활성화되지 않았으면 컨텍스트 메뉴를 생성하지 않음
        if (!this.isDesignMode) return;
        
        this.contextMenu = this.createContextMenu();
        document.body.appendChild(this.contextMenu);
        
        // 우클릭 이벤트
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        document.addEventListener('click', () => this.hideContextMenu());
    }
    
    /**
     * 컨텍스트 메뉴 생성
     */
    createContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <button class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> 삭제
            </button>
        `;
        
        // 메뉴 아이템 클릭 이벤트
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextAction(action);
                this.hideContextMenu();
            });
        });
        
        return menu;
    }
    
    /**
     * 컨텍스트 메뉴 표시
     */
    handleContextMenu(e) {
        if (!this.isDesignMode || !this.contextMenu) return;
        
        e.preventDefault();
        
        const x = e.clientX;
        const y = e.clientY;
        
        // 화면 경계 확인하여 메뉴가 화면을 벗어나지 않도록 조정
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let adjustedX = x;
        let adjustedY = y;
        
        // 오른쪽 경계 확인
        if (x + 180 > viewportWidth) {
            adjustedX = viewportWidth - 190;
        }
        
        // 아래쪽 경계 확인
        if (y + 200 > viewportHeight) {
            adjustedY = viewportHeight - 210;
        }
        
        this.contextMenu.style.left = adjustedX + 'px';
        this.contextMenu.style.top = adjustedY + 'px';
        this.contextMenu.style.display = 'block';
        
        // 선택된 요소가 있는지 확인하여 메뉴 아이템 활성화/비활성화
        this.updateContextMenuItems();
    }
    
    /**
     * 컨텍스트 메뉴 숨기기
     */
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }
    
    /**
     * 컨텍스트 메뉴 아이템 업데이트
     */
    updateContextMenuItems() {
        const hasSelection = this.floorPlanManager.selectedElements.size > 0;
        
        this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            const action = item.dataset.action;
            
            if (action === 'delete') {
                item.classList.toggle('disabled', !hasSelection);
            }
        });
    }
    
    /**
     * 컨텍스트 액션 처리
     */
    handleContextAction(action) {
        switch (action) {
            case 'delete':
                // 선택된 요소가 있으면 삭제
                if (this.floorPlanManager.selectedElements.size > 0) {
                    const elements = Array.from(this.floorPlanManager.selectedElements);
                    elements.forEach(element => {
                        element.remove();
                    });
                    this.floorPlanManager.selectedElements.clear();
                    this.floorPlanManager.updateSelectedElementsPanel();
                    this.hasUnsavedChanges = true;
                    console.log('요소 삭제 완료:', elements.length + '개');
                }
                break;
        }
    }
    
    /**
     * 변경사항 감지 설정
     */
    setupChangeDetection() {
        // 원본 데이터와 비교하여 변경사항 감지
        setInterval(() => {
            if (this.isDesignMode && this.originalData) {
                const currentData = this.getCurrentData();
                if (JSON.stringify(currentData) !== JSON.stringify(this.originalData)) {
                    this.hasUnsavedChanges = true;
                }
            }
        }, 1000);
    }
    
    /**
     * 원본 데이터 저장
     */
    saveOriginalData() {
        this.originalData = this.getCurrentData();
    }
    
    /**
     * 현재 데이터 가져오기
     */
    getCurrentData() {
        return {
            buildings: this.floorPlanManager.floorPlanData.buildings,
            rooms: this.floorPlanManager.floorPlanData.rooms,
            shapes: this.floorPlanManager.floorPlanData.shapes,
            otherSpaces: this.floorPlanManager.floorPlanData.otherSpaces
        };
    }
    
    /**
     * 페이지 이탈 경고 설정
     */
    setupPageLeaveWarning() {
        this.beforeUnloadHandler = (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '저장되지 않은 변경사항이 있습니다. 정말 페이지를 떠나시겠습니까?';
                return e.returnValue;
            }
        };
        
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    /**
     * 페이지 이탈 경고 제거
     */
    removePageLeaveWarning() {
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
    }
    
    /**
     * 확대 - 무한 캔버스 직접 조작
     */
    zoomIn() {
        if (this.infiniteCanvasManager) {
            const currentTransform = this.infiniteCanvasManager.getTransform();
            const newScale = Math.min(currentTransform.scale + 0.1, 3.0);
            this.infiniteCanvasManager.setTransform(newScale, currentTransform.translateX, currentTransform.translateY);
            console.log('🔍 무한 캔버스 확대:', { scale: newScale });
        } else if (this.floorPlanManager.zoomManager) {
            this.floorPlanManager.zoomManager.zoomIn();
        }
    }
    
    /**
     * 축소 - 무한 캔버스 직접 조작
     */
    zoomOut() {
        if (this.infiniteCanvasManager) {
            const currentTransform = this.infiniteCanvasManager.getTransform();
            const newScale = Math.max(currentTransform.scale - 0.1, 0.25);
            this.infiniteCanvasManager.setTransform(newScale, currentTransform.translateX, currentTransform.translateY);
            console.log('🔍 무한 캔버스 축소:', { scale: newScale });
        } else if (this.floorPlanManager.zoomManager) {
            this.floorPlanManager.zoomManager.zoomOut();
        }
    }
    
    /**
     * 화면에 맞춤 줌
     */
    zoomToFit() {
        if (this.floorPlanManager.zoomManager) {
            this.floorPlanManager.zoomManager.zoomToFit();
        }
    }
    
    /**
     * 요소 데이터 가져오기
     */
    getElementData(element) {
        const rect = element.getBoundingClientRect();
        const canvasRect = this.floorPlanManager.canvas.getBoundingClientRect();
        
        return {
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height,
            name: element.dataset.name || element.textContent || '새 요소'
        };
    }
    
    /**
     * PPT 다운로드
     */
    downloadPPT() {
        if (!this.floorPlanManager.currentSchoolId) {
            alert('학교를 먼저 선택해주세요.');
            return;
        }
        
        console.log('PPT 다운로드 시작, schoolId:', this.floorPlanManager.currentSchoolId);
        
        // 알림 표시
        this.showNotification('PPT 파일을 생성하는 중입니다...', 'info');
        
        // PPT 다운로드 API 호출
        fetch(`/floorplan/export/ppt?schoolId=${this.floorPlanManager.currentSchoolId}`, {
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
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            a.download = `평면도_${date}.pptx`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('PPT 파일이 다운로드되었습니다.', 'success');
            console.log('✅ PPT 다운로드 완료');
        })
        .catch(error => {
            console.error('PPT 다운로드 오류:', error);
            this.showNotification('PPT 다운로드에 실패했습니다: ' + error.message, 'error');
        });
    }
    
    /**
     * 알림 메시지 표시
     */
    showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10002;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * 알림 색상 가져오기
     */
    getNotificationColor(type) {
        switch (type) {
            case 'success': return '#10b981';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6b7280';
        }
    }
    
    /**
     * 무한 캔버스 시스템 초기화 (간소화 버전)
     */
    initializeInfiniteCanvas() {
        console.log('🌐 무한 캔버스 시스템 초기화 시작');
        
        try {
            // 캔버스 컨테이너 찾기
            this.canvasContainer = document.getElementById('fullscreenCanvasContainer');
            if (!this.canvasContainer) {
                console.warn('⚠️ 캔버스 컨테이너를 찾을 수 없습니다.');
                return;
            }
            
            // 1. InfiniteCanvasManager 초기화
            this.infiniteCanvasManager = new InfiniteCanvasManager(this.canvasContainer);
            console.log('✅ InfiniteCanvasManager 초기화 완료');
            
            // 2. PanManager 초기화
            this.panManager = new PanManager(this.infiniteCanvasManager, this.canvasContainer);
            this.panManager.enable();
            console.log('✅ PanManager 초기화 완료');
            
            // 3. AutoExpandManager 초기화
            this.autoExpandManager = new AutoExpandManager(this.infiniteCanvasManager);
            console.log('✅ AutoExpandManager 초기화 완료');
            
            // 4. DragPreviewManager 초기화
            this.dragPreviewManager = new DragPreviewManager(this.infiniteCanvasManager);
            console.log('✅ DragPreviewManager 초기화 완료');
            
            // 5. CanvasRenderer 초기화
            this.canvasRenderer = new CanvasRenderer(this.infiniteCanvasManager);
            console.log('✅ CanvasRenderer 초기화 완료');
            
            // 6. FloorPlanManager의 캔버스를 무한 캔버스로 교체 ⭐ 중요!
            this.floorPlanManager.canvas = this.infiniteCanvasManager.canvas;
            console.log('✅ FloorPlanManager.canvas → infiniteCanvas 연결');
            
            // 6-1. FloorPlanManager에 designModeManager 참조 설정 (좌표 변환용)
            this.floorPlanManager.designModeManager = this;
            console.log('✅ FloorPlanManager.designModeManager 참조 설정');
            
            // 6-2. ZoomManager 연결 제거 (충돌 방지)
            // 무한 캔버스 모드에서는 ZoomManager를 사용하지 않음
            
            // 6-2. 새 캔버스에 이벤트 다시 바인딩 ⭐⭐⭐ 가장 중요!
            this.rebindCanvasEvents();
            console.log('✅ 새 캔버스에 이벤트 바인딩 완료');
            
            // 7. DragManager 연결
            if (this.floorPlanManager.dragManager) {
                this.floorPlanManager.dragManager.infiniteCanvasManager = this.infiniteCanvasManager;
                this.floorPlanManager.dragManager.autoExpandManager = this.autoExpandManager;
                console.log('✅ DragManager 연결');
            }
            
            // 8. ZoomManager 연결
            if (this.floorPlanManager.zoomManager) {
                this.floorPlanManager.zoomManager.infiniteCanvasManager = this.infiniteCanvasManager;
                console.log('✅ ZoomManager 연결');
            }
            
            // 9. 초기 렌더링
            this.canvasRenderer.renderAllElements();
            
            // 10. 뷰포트 변경 이벤트
            this.infiniteCanvasManager.onTransformChange = () => {
                this.canvasRenderer.onViewportChange();
            };
            
            console.log('✅ 무한 캔버스 시스템 초기화 완료');
            
        } catch (error) {
            console.error('❌ 무한 캔버스 시스템 초기화 실패:', error);
        }
    }
    
    /**
     * 무한 캔버스 시스템 정리
     */
    destroyInfiniteCanvas() {
        console.log('🧹 무한 캔버스 시스템 정리');
        
        try {
            // PanManager 비활성화
            if (this.panManager) {
                this.panManager.disable();
                this.panManager = null;
            }
            
            // DragPreviewManager 정리
            if (this.dragPreviewManager) {
                this.dragPreviewManager.removePreview();
                this.dragPreviewManager = null;
            }
            
            // InfiniteCanvasManager 정리
            if (this.infiniteCanvasManager) {
                this.infiniteCanvasManager.destroy();
                this.infiniteCanvasManager = null;
            }
            
            // FloorPlanManager의 캔버스를 원래대로 복원
            if (this.originalCanvas) {
                this.floorPlanManager.canvas = this.originalCanvas;
                console.log('♻️ FloorPlanManager.canvas 원래대로 복원');
            }
            
            // FloorPlanManager에서 designModeManager 참조 제거
            if (this.floorPlanManager.designModeManager) {
                this.floorPlanManager.designModeManager = null;
                console.log('♻️ FloorPlanManager.designModeManager 참조 제거');
            }
            
            // ZoomManager 연결은 이미 없으므로 해제 불필요
            
            // 나머지 정리
            this.autoExpandManager = null;
            this.canvasRenderer = null;
            this.canvasContainer = null;
            
            console.log('✅ 무한 캔버스 시스템 정리 완료');
            
        } catch (error) {
            console.error('❌ 무한 캔버스 시스템 정리 실패:', error);
        }
    }
    
    /**
     * 새 캔버스에 이벤트 다시 바인딩
     */
    rebindCanvasEvents() {
        console.log('🔄 새 캔버스에 이벤트 바인딩 시작');
        
        const canvas = this.floorPlanManager.canvas;
        if (!canvas) {
            console.error('❌ 캔버스를 찾을 수 없습니다!');
            return;
        }
        
        // 캔버스 전용 이벤트만 다시 바인딩 (기존 이벤트는 자동 제거됨)
        this.floorPlanManager.bindCanvasEvents();
        
        console.log('✅ 이벤트 바인딩 완료:', canvas.id);
    }
}
