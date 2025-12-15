/**
 * ClassroomDesignMode.js
 * 교실 설계 모드 매니저
 * 
 * 책임:
 * - 건물/교실/도형 요소 생성 및 배치
 * - 미배치 교실 관리
 * - 요소 크기 조정 및 이동
 * - 레이어 순서(z-index) 관리
 * - 캔버스 초기화
 */

export default class ClassroomDesignMode {
    constructor(core, elementManager, uiManager, historyManager = null) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        
        this.currentTool = null; // 'building', 'room', 'rectangle', 'circle', 'line', 'dashed-line'
        this.currentColor = '#000000';
        this.currentLineWidth = 2;
        this.currentFillColor = '#ffffff';  // 흰색
        
        // 커스텀 요소 크기 (기본값: 교실 기본 크기)
        this.customElementWidth = 280;  // 교실 기본 너비
        this.customElementHeight = 180;  // 교실 기본 높이
        
        // 이름박스 기본 크기
        this.defaultNameBoxWidth = 160;  // 이름박스 기본 너비
        this.defaultNameBoxHeight = 40;  // 이름박스 기본 높이
        
        this.selectedElements = [];
        this.isDrawing = false;
        this.drawStartPos = null;
        
        // 미배치 교실 선택 상태 (클릭 방식으로 변경)
        this.selectedUnplacedClassroom = null; // { classroomId, classroomName }
        
        console.log('📐 ClassroomDesignMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    activate() {
        console.log('✅ 교실설계 모드 활성화');
        const header = document.querySelector('.workspace-header');
        if (header) {
            header.classList.add('classroom-mode');
        }
        this.setupUI();
        this.bindEvents();
        this.setupHeaderTools(); // 헤더 도구 설정
        
        // 헤더 도구 표시
        const headerTools = document.getElementById('workspace-tools');
        if (headerTools) {
            console.log('🛠️ 헤더 도구 표시 설정 전:', headerTools.style.display);
            headerTools.style.display = 'flex';
            console.log('🛠️ 헤더 도구 표시 설정 후:', headerTools.style.display);
            
            // 모바일 및 랩탑에서 레이어가 보이도록 스크롤 위치를 맨 왼쪽으로 리셋 (여러 번 시도)
            if (window.innerWidth <= 1200) {
                const firstToolGroup = headerTools.querySelector('.header-tool-group:first-child');
                
                const resetScroll = () => {
                    headerTools.scrollLeft = 0;
                    // 첫 번째 요소로 스크롤
                    if (firstToolGroup) {
                        firstToolGroup.scrollIntoView({ 
                            behavior: 'auto', 
                            block: 'nearest', 
                            inline: 'start' 
                        });
                    }
                };
                
                // 즉시 리셋
                resetScroll();
                requestAnimationFrame(() => {
                    resetScroll();
                });
                
                // 레이아웃 안정화 후 여러 번 재시도
                setTimeout(resetScroll, 50);
                setTimeout(resetScroll, 100);
                setTimeout(resetScroll, 200);
                setTimeout(resetScroll, 300);
                setTimeout(resetScroll, 500);
            }
            
            // 내부 요소들도 확인
            const lineColor = document.getElementById('header-line-color');
            const fillColor = document.getElementById('header-fill-color');
            const lineWidth = document.getElementById('header-line-width');
            console.log('🛠️ 헤더 도구 내부 요소 확인:', {
                lineColor: !!lineColor,
                fillColor: !!fillColor,
                lineWidth: !!lineWidth
            });
        } else {
            console.error('❌ workspace-tools 요소를 찾을 수 없음!');
        }
        
        // 모든 요소 잠금 해제
        this.unlockAllElements();
        
        // 레이어 버튼 초기 상태 설정
        this.updateLayerButtons();
        
        // 선택 상태 변경 감지를 위한 주기적 체크
        this.selectionCheckInterval = setInterval(() => {
            this.updateLayerButtons();
        }, 200); // 200ms마다 체크
        
        // 캔버스에 이미 배치된 교실 ID 추적 및 데이터 수집
        this.placedClassroomIds = new Set();
        this.loadedClassroomData = []; // 로드된 교실 데이터 (삭제 시 복원용)
        
        const roomElements = this.core.state.elements.filter(el => el.elementType === 'room' && el.classroomId);
        roomElements.forEach(room => {
            const classroomId = String(room.classroomId);
            this.placedClassroomIds.add(classroomId);
            
            // 로드된 교실 데이터 저장 (미배치 목록 복원용)
            this.loadedClassroomData.push({
                classroomId: room.classroomId,
                roomName: room.label || `교실 ${room.classroomId}`,
                id: room.classroomId,
                // 추가 필드가 있으면 여기 추가
            });
            
            console.log('📍 배치된 교실 추적:', { 
                classroomId: room.classroomId, 
                label: room.label,
                referenceId: room.referenceId 
            });
        });
        
        console.log('📍 이미 배치된 교실:', this.placedClassroomIds.size, '개');
        console.log('📍 배치된 교실 ID 목록:', Array.from(this.placedClassroomIds));
        console.log('💾 로드된 교실 데이터:', this.loadedClassroomData.length, '개');
        
        // 미배치 교실 로드
        if (this.core.currentSchoolId) {
            this.loadUnplacedClassrooms(this.core.currentSchoolId);
        }
        
        // 현재 요소들 기준으로 뷰 자동 피팅 (장비보기 모드와 동일한 기준을 유지)
        if (this.core && this.core.state && this.core.state.elements) {
            this.core.fitToElements();
        }
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 교실설계 모드 비활성화');
        const header = document.querySelector('.workspace-header');
        if (header) {
            header.classList.remove('classroom-mode');
        }
        
        // 헤더 도구 숨기기
        const headerTools = document.getElementById('workspace-tools');
        if (headerTools) {
            headerTools.style.display = 'none';
        }
        
        // 선택 체크 interval 정리
        if (this.selectionCheckInterval) {
            clearInterval(this.selectionCheckInterval);
            this.selectionCheckInterval = null;
        }
        
        this.unbindEvents();
        this.clearSelection();
    }

    getViewModeForButton() {
        return 'view-equipment';
    }
    
    /**
     * 모바일 툴바 좌측 사이드바 설정
     */
    setupMobileToolbar(toolbarContainer) {
        // 초기 상태: 접힌 형태가 기본 (한 줄 상태)
        toolbarContainer.classList.remove('hidden', 'expanded');
        toolbarContainer.classList.add('collapsed');
        
        const canvasContainer = document.querySelector('.workspace-canvas-container');
        
        // 캔버스 패딩 업데이트 함수
        const updateCanvasPadding = () => {
            if (!canvasContainer) return;
            canvasContainer.classList.remove('toolbar-hidden', 'toolbar-expanded', 'toolbar-collapsed');
            if (toolbarContainer.classList.contains('hidden')) {
                canvasContainer.classList.add('toolbar-hidden');
            } else if (toolbarContainer.classList.contains('expanded')) {
                canvasContainer.classList.add('toolbar-expanded');
            } else if (toolbarContainer.classList.contains('collapsed')) {
                canvasContainer.classList.add('toolbar-collapsed');
            }
        };
        
        // 초기 패딩 설정 (접힌 상태)
        updateCanvasPadding();
        
        // 토글 버튼 아이콘 업데이트
        const toggleBtn = document.getElementById('toolbar-toggle-btn');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class=\"fas fa-chevron-right\"></i>';
            toggleBtn.title = '도구창 숨기기';
        }
        
        // 토글 버튼 클릭 이벤트 재설정
        if (toggleBtn) {
            // 기존 이벤트 리스너 제거하고 새로 등록
            const newToggleBtn = toggleBtn.cloneNode(true);
            if (toggleBtn.parentNode) {
                toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
            }
            
            // 토글 버튼 참조를 새로 만든 버튼으로 업데이트
            const self = this;
            const toolbarToggleBtn = newToggleBtn;
            
            newToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (toolbarContainer.classList.contains('collapsed')) {
                    // 접힌 상태 (기본 상태) -> 완전히 숨김
                    toolbarContainer.classList.remove('collapsed');
                    toolbarContainer.classList.add('hidden');
                    
                    // 숨김 상태일 때 토글 버튼을 body에 직접 추가
                    self.moveToggleButtonToBody(toolbarToggleBtn);
                } else if (toolbarContainer.classList.contains('hidden')) {
                    // 숨김 상태 -> 접힌 상태로 복귀 (기본 상태)
                    toolbarContainer.classList.remove('hidden');
                    toolbarContainer.classList.add('collapsed');
                    
                    // 토글 버튼을 도구창으로 다시 이동
                    self.moveToggleButtonToToolbar(toolbarToggleBtn, toolbarContainer);
                } else if (toolbarContainer.classList.contains('expanded')) {
                    // 확장 상태 -> 접힌 상태 (기본 상태로 복귀)
                    toolbarContainer.classList.remove('expanded');
                    toolbarContainer.classList.add('collapsed');
                }
                updateCanvasPadding();
                self.updateToolbarToggleIcon(toolbarContainer, toolbarToggleBtn);
            });
        }
        
        // 숨김 상태에서 다시 표시할 버튼 생성 (호환성 유지)
        this.createToolbarShowButton(toolbarContainer);
    }
    
    /**
     * 숨김 상태일 때 토글 버튼을 body로 이동
     */
    moveToggleButtonToBody(toggleBtn) {
        if (!toggleBtn) return;
        
        // 이미 body에 있으면 스타일만 재적용
        if (toggleBtn.parentElement === document.body) {
            toggleBtn.classList.add('toolbar-toggle-hidden');
            this.applyHiddenToggleStyles(toggleBtn);
            return;
        }
        
        // 현재 부모에서 제거하고 body에 추가
        try {
            if (toggleBtn.parentElement) {
                toggleBtn.parentElement.removeChild(toggleBtn);
            }
            document.body.appendChild(toggleBtn);
            
            // 숨김 상태용 클래스 추가
            toggleBtn.classList.add('toolbar-toggle-hidden');
            
            // 강제로 표시되도록 스타일 적용
            this.applyHiddenToggleStyles(toggleBtn);
            
            console.log('✅ 토글 버튼을 body로 이동 완료', {
                parent: toggleBtn.parentElement,
                classes: toggleBtn.className,
                styles: {
                    position: toggleBtn.style.position,
                    left: toggleBtn.style.left,
                    top: toggleBtn.style.top,
                    opacity: toggleBtn.style.opacity,
                    display: toggleBtn.style.display,
                    zIndex: toggleBtn.style.zIndex
                }
            });
            
            // 디버깅: DOM에 실제로 있는지 확인
            setTimeout(() => {
                const checkBtn = document.querySelector('body > .toolbar-toggle-btn');
                console.log('🔍 body에 토글 버튼 확인:', checkBtn, checkBtn ? checkBtn.offsetParent : 'null');
                if (checkBtn) {
                    console.log('🔍 컴퓨팅된 스타일:', {
                        position: window.getComputedStyle(checkBtn).position,
                        left: window.getComputedStyle(checkBtn).left,
                        top: window.getComputedStyle(checkBtn).top,
                        opacity: window.getComputedStyle(checkBtn).opacity,
                        display: window.getComputedStyle(checkBtn).display,
                        visibility: window.getComputedStyle(checkBtn).visibility,
                        zIndex: window.getComputedStyle(checkBtn).zIndex,
                        transform: window.getComputedStyle(checkBtn).transform
                    });
                }
            }, 100);
        } catch (error) {
            console.error('❌ 토글 버튼 이동 오류:', error);
        }
    }
    
    /**
     * 숨김 상태 토글 버튼 스타일 적용
     */
    applyHiddenToggleStyles(toggleBtn) {
        if (!toggleBtn) return;
        
        // 모든 스타일을 인라인으로 강제 적용 (내부 토글과 동일한 외관)
        toggleBtn.style.cssText = `
            position: fixed !important;
            left: 10px !important;
            top: 50% !important;
            right: auto !important;
            transform: translateY(-50%) !important;
            width: 36px !important;
            height: 36px !important;
            background: #f3f4f6 !important;
            color: #334155 !important;
            border-radius: 6px !important;
            font-size: 0.9rem !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            z-index: 20001 !important;
            pointer-events: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            transition: none !important;
        `;
    }
    
    /**
     * 토글 버튼을 도구창으로 다시 이동
     */
    moveToggleButtonToToolbar(toggleBtn, toolbarContainer) {
        if (!toggleBtn || !toolbarContainer) return;
        
        // body에 있으면 도구창으로 이동
        try {
            if (toggleBtn.parentElement === document.body) {
                document.body.removeChild(toggleBtn);
                toolbarContainer.insertBefore(toggleBtn, toolbarContainer.firstChild);
            }
            
            // 숨김 상태용 클래스 제거 및 스타일 초기화
            toggleBtn.classList.remove('toolbar-toggle-hidden');
            toggleBtn.style.position = '';
            toggleBtn.style.left = '';
            toggleBtn.style.top = '';
            toggleBtn.style.transform = '';
            toggleBtn.style.opacity = '';
            toggleBtn.style.visibility = '';
            toggleBtn.style.pointerEvents = '';
            
            console.log('✅ 토글 버튼을 도구창으로 복귀 완료');
        } catch (error) {
            console.error('❌ 토글 버튼 복귀 오류:', error);
        }
    }
    
    /**
     * 도구창 표시 버튼 생성
     */
    createToolbarShowButton(toolbarContainer) {
        // 이미 있으면 제거
        const existingBtn = document.querySelector('.toolbar-show-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const showBtn = document.createElement('button');
        showBtn.className = 'toolbar-show-btn';
        showBtn.innerHTML = '<i class="fas fa-bars"></i>';
        showBtn.title = '도구창 표시';
        showBtn.style.display = 'none';
        
        showBtn.addEventListener('click', () => {
            toolbarContainer.classList.remove('hidden');
            showBtn.style.display = 'none';
            const canvasContainer = document.querySelector('.workspace-canvas-container');
            if (canvasContainer) {
                canvasContainer.classList.remove('toolbar-hidden');
            }
            const toggleBtn = document.getElementById('toolbar-toggle-btn');
            if (toggleBtn) {
                this.updateToolbarToggleIcon(toolbarContainer, toggleBtn);
            }
        });
        
        document.body.appendChild(showBtn);
    }
    
    /**
     * 도구창 표시 버튼 표시
     */
    showToolbarShowButton() {
        const showBtn = document.querySelector('.toolbar-show-btn');
        if (showBtn) {
            showBtn.style.display = 'flex';
        }
    }
    
    /**
     * 토글 버튼 아이콘 업데이트
     */
    updateToolbarToggleIcon(toolbarContainer, toggleBtn) {
        if (!toggleBtn) return;
        
        if (toolbarContainer.classList.contains('hidden')) {
            // 숨김 상태: 내부 토글과 동일한 아이콘(> 방향) 유지
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            toggleBtn.title = '도구창 표시';
        } else if (toolbarContainer.classList.contains('collapsed')) {
            // 접힌 상태 (기본 상태): 도구창 내부 우측 상단
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            toggleBtn.title = '도구창 숨기기';
        } else if (toolbarContainer.classList.contains('expanded')) {
            // 확장 상태: 도구창 내부 우측 상단
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            toggleBtn.title = '도구창 접기';
        }
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        const toolbar = document.getElementById('design-toolbar');
        if (!toolbar) return;
        
        // 도구창 간소화 토글 버튼 추가
        const toolbarContainer = document.getElementById('design-toolbar-container');
        if (toolbarContainer && !document.getElementById('toolbar-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'toolbar-toggle-btn';
            toggleBtn.className = 'toolbar-toggle-btn';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            toggleBtn.title = '도구창 접기/펼치기';
            toolbarContainer.insertBefore(toggleBtn, toolbar);
            
            // 모바일 감지 및 바텀 시트 기능 설정
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.setupMobileToolbar(toolbarContainer);
            }
            
            // 저장된 상태 불러오기 (데스크톱만)
            if (!isMobile) {
                const isCollapsed = localStorage.getItem('toolbar-collapsed') === 'true';
                if (isCollapsed) {
                    toolbarContainer.classList.add('collapsed');
                }
            }
            
            // 토글 이벤트 (데스크톱만, 모바일은 setupMobileToolbar에서 처리)
            if (!isMobile) {
                toggleBtn.addEventListener('click', () => {
                    toolbarContainer.classList.toggle('collapsed');
                    const collapsed = toolbarContainer.classList.contains('collapsed');
                    localStorage.setItem('toolbar-collapsed', collapsed);
                    
                    // 아이콘 업데이트
                    if (collapsed) {
                        toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                    } else {
                        toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                    }
                });
            }
            
            // 윈도우 리사이즈 감지
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const nowMobile = window.innerWidth <= 768;
                    if (nowMobile !== isMobile) {
                        location.reload(); // 모바일/데스크톱 전환 시 리로드
                    }
                }, 250);
            });
        }
        
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <h3>기본 크기 설정</h3>
                <div class="size-control-group">
                    <div class="size-label-row">
                        <label class="size-label">교실/건물 크기</label>
                        <button class="size-reset-btn" id="reset-element-size-btn" title="기본값으로 복원">
                            <i class="fas fa-undo"></i>
                        </button>
                    </div>
                    <div class="size-inputs">
                        <input type="number" id="toolbar-element-width-input" class="size-input" value="280" min="20" max="2000" step="10" title="가로 크기 (px)">
                        <span class="size-separator">×</span>
                        <input type="number" id="toolbar-element-height-input" class="size-input" value="180" min="20" max="2000" step="10" title="세로 크기 (px)">
                    </div>
                </div>
                <div class="size-control-group">
                    <div class="size-label-row">
                        <label class="size-label">이름박스 크기</label>
                        <button class="size-reset-btn" id="reset-namebox-size-btn" title="기본값으로 복원">
                            <i class="fas fa-undo"></i>
                        </button>
                    </div>
                    <div class="size-inputs">
                        <input type="number" id="toolbar-namebox-width-input" class="size-input" value="160" min="20" max="2000" step="10" title="가로 크기 (px)">
                        <span class="size-separator">×</span>
                        <input type="number" id="toolbar-namebox-height-input" class="size-input" value="40" min="20" max="2000" step="10" title="세로 크기 (px)">
                    </div>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>요소 생성</h3>
                <div class="tool-buttons">
                    <button class="tool-btn" data-tool="building" title="건물 추가">
                        <i class="fas fa-building"></i> 건물
                    </button>
                    <button class="tool-btn" data-tool="room" title="교실 추가">
                        <i class="fas fa-door-open"></i> 교실
                    </button>
                    <button class="tool-btn" data-tool="toilet" title="화장실">
                        <i class="fas fa-restroom"></i> 화장실
                    </button>
                    <button class="tool-btn" data-tool="elevator" title="엘리베이터">
                        <i class="fas fa-elevator"></i> EV
                    </button>
                    <button class="tool-btn" data-tool="entrance" title="현관">
                        <i class="fas fa-door-open"></i> 현관
                    </button>
                    <button class="tool-btn" data-tool="stairs" title="계단">
                        <i class="fas fa-stairs"></i> 계단
                    </button>
                    <button class="tool-btn" data-tool="rectangle" title="사각형">
                        <i class="fas fa-square"></i> 사각형
                    </button>
                    <button class="tool-btn" data-tool="circle" title="원">
                        <i class="fas fa-circle"></i> 원
                    </button>
                    <button class="tool-btn" data-tool="line" title="선">
                        <i class="fas fa-minus"></i> 선
                    </button>
                    <button class="tool-btn" data-tool="dashed-line" title="점선">
                        <i class="fas fa-ellipsis-h"></i> 점선
                    </button>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>미배치 교실</h3>
                <div id="unplaced-classrooms-list" class="unplaced-list">
                    <p class="loading">로딩 중...</p>
                </div>
            </div>
        `;
        
        // 이벤트 바인딩
        this.bindToolbarEvents();
        
        // 크기 입력 필드 이벤트 바인딩 (도구창 생성 후)
        this.bindSizeInputEvents();
    }
    
    /**
     * 크기 입력 필드 이벤트 바인딩
     */
    bindSizeInputEvents() {
        // 좌측 도구창의 교실/건물 크기 입력 필드
        const toolbarWidthInput = document.getElementById('toolbar-element-width-input');
        const toolbarHeightInput = document.getElementById('toolbar-element-height-input');
        
        if (toolbarWidthInput) {
            // HTML 요소의 현재 값을 읽어와서 this.customElementWidth에 설정
            this.customElementWidth = parseInt(toolbarWidthInput.value) || this.customElementWidth;
            console.log('📐 초기 가로 크기:', this.customElementWidth);
            
            toolbarWidthInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.customElementWidth = value;
                    console.log('📐 가로 크기 변경:', this.customElementWidth);
                }
            });
            toolbarWidthInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.customElementWidth = value;
                    console.log('📐 가로 크기 확정:', this.customElementWidth);
                } else {
                    // 범위를 벗어나면 기본값으로 복원
                    e.target.value = this.customElementWidth;
                }
            });
        } else {
            console.warn('⚠️ toolbar-element-width-input 요소를 찾을 수 없습니다!');
        }
        
        if (toolbarHeightInput) {
            // HTML 요소의 현재 값을 읽어와서 this.customElementHeight에 설정
            this.customElementHeight = parseInt(toolbarHeightInput.value) || this.customElementHeight;
            console.log('📐 초기 세로 크기:', this.customElementHeight);
            
            toolbarHeightInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.customElementHeight = value;
                    console.log('📐 세로 크기 변경:', this.customElementHeight);
                }
            });
            toolbarHeightInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.customElementHeight = value;
                    console.log('📐 세로 크기 확정:', this.customElementHeight);
                } else {
                    // 범위를 벗어나면 기본값으로 복원
                    e.target.value = this.customElementHeight;
                }
            });
        } else {
            console.warn('⚠️ toolbar-element-height-input 요소를 찾을 수 없습니다!');
        }
        
        // 이름박스 기본 크기 설정
        if (!this.defaultNameBoxWidth) {
            this.defaultNameBoxWidth = 160;
        }
        if (!this.defaultNameBoxHeight) {
            this.defaultNameBoxHeight = 40;
        }
        
        const nameboxWidthInput = document.getElementById('toolbar-namebox-width-input');
        const nameboxHeightInput = document.getElementById('toolbar-namebox-height-input');
        
        if (nameboxWidthInput) {
            this.defaultNameBoxWidth = parseInt(nameboxWidthInput.value) || this.defaultNameBoxWidth;
            console.log('📐 초기 이름박스 가로 크기:', this.defaultNameBoxWidth);
            
            nameboxWidthInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.defaultNameBoxWidth = value;
                    console.log('📐 이름박스 가로 크기 변경:', this.defaultNameBoxWidth);
                }
            });
            nameboxWidthInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.defaultNameBoxWidth = value;
                    console.log('📐 이름박스 가로 크기 확정:', this.defaultNameBoxWidth);
                } else {
                    e.target.value = this.defaultNameBoxWidth;
                }
            });
        }
        
        if (nameboxHeightInput) {
            this.defaultNameBoxHeight = parseInt(nameboxHeightInput.value) || this.defaultNameBoxHeight;
            console.log('📐 초기 이름박스 세로 크기:', this.defaultNameBoxHeight);
            
            nameboxHeightInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.defaultNameBoxHeight = value;
                    console.log('📐 이름박스 세로 크기 변경:', this.defaultNameBoxHeight);
                }
            });
            nameboxHeightInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 20 && value <= 2000) {
                    this.defaultNameBoxHeight = value;
                    console.log('📐 이름박스 세로 크기 확정:', this.defaultNameBoxHeight);
                } else {
                    e.target.value = this.defaultNameBoxHeight;
                }
            });
        }
        
        // 기본값 복원 버튼 이벤트
        const resetElementSizeBtn = document.getElementById('reset-element-size-btn');
        if (resetElementSizeBtn) {
            resetElementSizeBtn.addEventListener('click', () => {
                const defaultWidth = 280;
                const defaultHeight = 180;
                
                if (toolbarWidthInput) {
                    toolbarWidthInput.value = defaultWidth;
                    this.customElementWidth = defaultWidth;
                }
                if (toolbarHeightInput) {
                    toolbarHeightInput.value = defaultHeight;
                    this.customElementHeight = defaultHeight;
                }
                
                console.log('🔄 교실/건물 크기 기본값으로 복원:', defaultWidth, '×', defaultHeight);
            });
        }
        
        const resetNameboxSizeBtn = document.getElementById('reset-namebox-size-btn');
        if (resetNameboxSizeBtn) {
            resetNameboxSizeBtn.addEventListener('click', () => {
                const defaultWidth = 160;
                const defaultHeight = 40;
                
                if (nameboxWidthInput) {
                    nameboxWidthInput.value = defaultWidth;
                    this.defaultNameBoxWidth = defaultWidth;
                }
                if (nameboxHeightInput) {
                    nameboxHeightInput.value = defaultHeight;
                    this.defaultNameBoxHeight = defaultHeight;
                }
                
                console.log('🔄 이름박스 크기 기본값으로 복원:', defaultWidth, '×', defaultHeight);
            });
        }
    }
    
    /**
     * 툴바 이벤트 바인딩
     */
    bindToolbarEvents() {
        // 도구 선택
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.selectTool(tool);
            });
        });
    }
    
    /**
     * 헤더 도구 설정 및 이벤트 바인딩
     */
    setupHeaderTools() {
        console.log('🔧 헤더 도구 설정 시작');
        
        // 스타일 컨트롤
        const lineColorInput = document.getElementById('header-line-color');
        console.log('🎨 선 색상 입력 요소:', lineColorInput ? '찾음' : '못 찾음', lineColorInput);
        
        if (lineColorInput) {
            // HTML 요소의 현재 값을 읽어와서 this.currentColor에 설정
            this.currentColor = lineColorInput.value || this.currentColor;
            console.log('🎨 초기 선 색상:', this.currentColor);
            
            lineColorInput.addEventListener('input', (e) => {
                this.currentColor = e.target.value;
                console.log('🎨 선 색상 변경 (input):', this.currentColor);
            });
            lineColorInput.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
                console.log('🎨 선 색상 확정 (change):', this.currentColor);
            });
        } else {
            console.error('❌ header-line-color 요소를 찾을 수 없습니다!');
        }
        
        const fillColorInput = document.getElementById('header-fill-color');
        console.log('🎨 채우기 색상 입력 요소:', fillColorInput ? '찾음' : '못 찾음');
        
        if (fillColorInput) {
            // HTML 요소의 현재 값을 읽어와서 this.currentFillColor에 설정
            this.currentFillColor = fillColorInput.value || this.currentFillColor;
            console.log('🎨 초기 채우기 색상:', this.currentFillColor);
            
            fillColorInput.addEventListener('input', (e) => {
                this.currentFillColor = e.target.value;
                console.log('🎨 채우기 색상 변경 (input):', this.currentFillColor);
            });
            fillColorInput.addEventListener('change', (e) => {
                this.currentFillColor = e.target.value;
                console.log('🎨 채우기 색상 확정 (change):', this.currentFillColor);
            });
        } else {
            console.error('❌ header-fill-color 요소를 찾을 수 없습니다!');
        }
        
        const lineWidthSelect = document.getElementById('header-line-width');
        console.log('📏 선 두께 선택 요소:', lineWidthSelect ? '찾음' : '못 찾음');
        
        if (lineWidthSelect) {
            this.currentLineWidth = parseInt(lineWidthSelect.value) || this.currentLineWidth;
            console.log('📏 초기 선 두께:', this.currentLineWidth);
            
            lineWidthSelect.addEventListener('change', (e) => {
                this.currentLineWidth = parseInt(e.target.value);
                console.log('📏 선 두께 변경:', this.currentLineWidth);
            });
        } else {
            console.error('❌ header-line-width 요소를 찾을 수 없습니다!');
        }
        
        
        console.log('🔧 헤더 도구 설정 완료 - 현재 상태:', {
            currentColor: this.currentColor,
            currentFillColor: this.currentFillColor,
            currentLineWidth: this.currentLineWidth,
            customElementWidth: this.customElementWidth,
            customElementHeight: this.customElementHeight
        });
        
        // 레이어 관리
        const bringForward = document.getElementById('header-bring-forward');
        if (bringForward) {
            bringForward.addEventListener('click', () => this.bringForward());
        }
        
        const sendBackward = document.getElementById('header-send-backward');
        if (sendBackward) {
            sendBackward.addEventListener('click', () => this.sendBackward());
        }
        
        // 추가 기능 드롭다운
        const moreBtn = document.getElementById('header-more-btn');
        const moreMenu = document.getElementById('header-more-menu');
        if (moreBtn && moreMenu) {
            let lastToggleAt = 0;
            const doToggle = () => {
                const now = Date.now();
                if (now - lastToggleAt < 200) return; // 중복 방지
                lastToggleAt = now;
                const helpMenuEl = document.getElementById('help-menu');
                if (helpMenuEl) helpMenuEl.style.display = 'none';
                const willOpen = (moreMenu.style.display === 'none' || !moreMenu.style.display);
                if (willOpen) {
                    // 위치 계산: 버튼 아래에 고정 위치로 띄우기 (오버플로우/스택 컨텍스트 회피)
                    const rect = moreBtn.getBoundingClientRect();
                    // body에 붙여 최상위 레이어로 이동
                    if (moreMenu.parentElement !== document.body) {
                        try { moreMenu.parentElement.removeChild(moreMenu); } catch(_) {}
                        document.body.appendChild(moreMenu);
                    }
                    Object.assign(moreMenu.style, {
                        position: 'fixed',
                        left: `${Math.max(8, rect.left)}px`,
                        top: `${rect.bottom + 6}px`,
                        right: 'auto',
                        maxWidth: 'min(90vw, 420px)',
                        zIndex: '20020',
                        display: 'block',
                        pointerEvents: 'auto',
                        background: '#ffffff',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        borderRadius: '8px'
                    });
                } else {
                    moreMenu.style.display = 'none';
                }
            };
            const toggleMoreMenu = (e) => {
                if (e) { e.preventDefault && e.preventDefault(); e.stopPropagation && e.stopPropagation(); }
                doToggle();
            };
            
            // 입력은 pointerup 하나로 통일 (모바일/데스크톱 공통)
            moreBtn.addEventListener('pointerup', toggleMoreMenu);
            
            // 외부 탭/클릭 시 닫기 (pointerdown 하나로 통일)
            const closeIfOutside = (e) => {
                const target = e.target;
                if (!moreMenu.contains(target) && !moreBtn.contains(target)) {
                    moreMenu.style.display = 'none';
                }
            };
            document.addEventListener('pointerdown', closeIfOutside, true);
        }
        
        // 캔버스 초기화
        const initBtn = document.getElementById('header-initialize-canvas');
        if (initBtn) {
            initBtn.addEventListener('click', () => {
                moreMenu.style.display = 'none';
                this.initializeCanvas();
            });
        }
        
        // 도움말 모달
        const helpBtn = document.getElementById('help-btn');
        const helpModal = document.getElementById('help-modal');
        const helpModalClose = document.getElementById('help-modal-close');
        
        if (helpBtn && helpModal) {
            // 도움말 버튼 클릭 시 모달 열기
            helpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 추가 기능 메뉴가 열려있으면 닫기
                if (moreMenu) moreMenu.style.display = 'none';
                helpModal.style.display = 'flex';
            });
            
            // 모달 닫기 버튼
            if (helpModalClose) {
                helpModalClose.addEventListener('click', () => {
                    helpModal.style.display = 'none';
            });
            }
            
            // 모달 배경 클릭 시 닫기
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.style.display = 'none';
                }
            });
            
            // ESC 키로 모달 닫기
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && helpModal.style.display === 'flex') {
                    helpModal.style.display = 'none';
                }
            });
        }
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        this.canvasClickHandler = (e) => this.handleCanvasClick(e);
        this.canvasMouseDownHandler = (e) => this.handleCanvasMouseDown(e);
        this.canvasMouseMoveHandler = (e) => this.handleCanvasMouseMove(e);
        this.canvasMouseUpHandler = (e) => this.handleCanvasMouseUp(e);
        this.keyDownHandler = (e) => this.handleKeyDown(e);
        
        const canvas = this.core.canvas;
        canvas.addEventListener('click', this.canvasClickHandler);
        canvas.addEventListener('mousedown', this.canvasMouseDownHandler);
        canvas.addEventListener('mousemove', this.canvasMouseMoveHandler);
        canvas.addEventListener('mouseup', this.canvasMouseUpHandler);
        
        // 모바일/태블릿: 터치 이벤트도 처리 (도형 그리기용)
        this.canvasTouchStartHandler = (e) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleCanvasMouseDown({
                    preventDefault: () => e.preventDefault(),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0
                });
            }
        };
        this.canvasTouchMoveHandler = (e) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleCanvasMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                e.preventDefault();
            }
        };
        this.canvasTouchEndHandler = (e) => {
            const touch = e.changedTouches && e.changedTouches.length > 0 
                ? e.changedTouches[0] 
                : (e.touches && e.touches.length > 0 ? e.touches[0] : null);
            if (touch) {
                this.handleCanvasMouseUp({
                    preventDefault: () => e.preventDefault(),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0
                });
            }
        };
        
        canvas.addEventListener('touchstart', this.canvasTouchStartHandler, { passive: false });
        canvas.addEventListener('touchmove', this.canvasTouchMoveHandler, { passive: false });
        canvas.addEventListener('touchend', this.canvasTouchEndHandler, { passive: false });
        
        // 키보드 이벤트 (스페이스바로 도구 해제)
        window.addEventListener('keydown', this.keyDownHandler);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasClickHandler) {
            canvas.removeEventListener('click', this.canvasClickHandler);
        }
        if (this.canvasMouseDownHandler) {
            canvas.removeEventListener('mousedown', this.canvasMouseDownHandler);
        }
        if (this.canvasMouseMoveHandler) {
            canvas.removeEventListener('mousemove', this.canvasMouseMoveHandler);
        }
        if (this.canvasMouseUpHandler) {
            canvas.removeEventListener('mouseup', this.canvasMouseUpHandler);
        }
        // 터치 이벤트 해제
        if (this.canvasTouchStartHandler) {
            canvas.removeEventListener('touchstart', this.canvasTouchStartHandler);
        }
        if (this.canvasTouchMoveHandler) {
            canvas.removeEventListener('touchmove', this.canvasTouchMoveHandler);
        }
        if (this.canvasTouchEndHandler) {
            canvas.removeEventListener('touchend', this.canvasTouchEndHandler);
        }
        if (this.keyDownHandler) {
            window.removeEventListener('keydown', this.keyDownHandler);
        }
    }
    
    /**
     * 키보드 이벤트 처리
     */
    handleKeyDown(e) {
        // Shift: 도구 선택 해제 (팬 모드 진입)
        if (e.shiftKey && this.currentTool) {
            this.selectTool(null);
            console.log('🔧 Shift: 도구 선택 해제');
        }
        
        // Escape: 도구 선택 해제 또는 미배치 교실 선택 해제
        if (e.code === 'Escape') {
            if (this.selectedUnplacedClassroom) {
                // 미배치 교실 선택 해제
                this.selectedUnplacedClassroom = null;
                document.querySelectorAll('.unplaced-classroom-item').forEach(el => {
                    el.classList.remove('selected');
                });
                // 커서를 기본값으로 복원
                if (this.core && this.core.canvas) {
                    this.core.canvas.style.cursor = 'default';
                }
                console.log('🔧 Escape: 미배치 교실 선택 해제');
            } else if (this.currentTool) {
                // 도구 선택 해제
                this.selectTool(null);
                console.log('🔧 Escape: 도구 선택 해제');
            }
        }
    }
    
    /**
     * 도구 선택
     */
    selectTool(tool) {
        this.currentTool = tool;
        
        // Core 상태 업데이트 (InteractionManager가 커서를 변경하지 않도록)
        this.core.setState({ activeTool: tool });
        
        // UI 업데이트 - 모든 버튼의 active 상태 제거
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // tool이 null이 아닐 때만 active 클래스 추가
        if (tool) {
            const toolButton = document.querySelector(`[data-tool="${tool}"]`);
            if (toolButton) {
                toolButton.classList.add('active');
            }
        }
        
        // 커서 스타일 변경
        if (this.currentTool) {
            this.core.canvas.style.cursor = 'crosshair';
        } else {
            this.core.canvas.style.cursor = 'default';
        }
        
        console.log('🔧 도구 선택:', tool, '| currentTool:', this.currentTool, '| activeTool:', this.core.state.activeTool);
    }
    
    /**
     * 캔버스 클릭 처리 (건물, 교실만)
     */
    handleCanvasClick(e) {
        console.log('🎯 handleCanvasClick 호출:', {
            currentTool: this.currentTool,
            selectedUnplacedClassroom: this.selectedUnplacedClassroom,
            clientX: e.clientX,
            clientY: e.clientY,
            target: e.target
        });
        
        // 미배치 교실이 선택된 경우 우선 처리
        if (this.selectedUnplacedClassroom) {
            const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
            console.log('📍 캔버스 좌표 변환:', {
                screen: { x: e.clientX, y: e.clientY },
                canvas: canvasPos
            });
            
            // 캔버스 경계 체크
            if (!this.isWithinCanvasBounds(canvasPos.x, canvasPos.y)) {
                console.warn('⚠️ 캔버스 경계 밖:', canvasPos);
                this.uiManager.showNotification('경고', '캔버스 영역 내에만 교실을 배치할 수 있습니다.', 'warning');
                return;
            }
            
            console.log('✅ 미배치 교실 배치 시작:', {
                classroomId: this.selectedUnplacedClassroom.classroomId,
                classroomName: this.selectedUnplacedClassroom.classroomName,
                pos: canvasPos
            });
            
            this.placeClassroom(
                this.selectedUnplacedClassroom.classroomId,
                this.selectedUnplacedClassroom.classroomName,
                canvasPos.x,
                canvasPos.y
            );
            
            // 배치 후 선택 해제
            this.selectedUnplacedClassroom = null;
            
            // 시각적 피드백 제거
            document.querySelectorAll('.unplaced-classroom-item').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 커서를 기본값으로 복원
            if (this.core && this.core.canvas) {
                this.core.canvas.style.cursor = 'default';
            }
            
            console.log('✅ 미배치 교실 배치 완료');
            return;
        }
        
        if (!this.currentTool) {
            console.warn('⚠️ currentTool이 없음');
            return;
        }
        
        // 도형은 mousedown/drag로 처리하므로 여기서는 제외
        if (['rectangle', 'circle', 'line', 'dashed-line', 'entrance', 'stairs'].includes(this.currentTool)) {
            console.log('📐 도형 도구는 mousedown으로 처리');
            return;
        }
        
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        console.log('📍 캔버스 좌표 변환:', {
            screen: { x: e.clientX, y: e.clientY },
            canvas: canvasPos
        });
        
        // 캔버스 경계 체크
        if (!this.isWithinCanvasBounds(canvasPos.x, canvasPos.y)) {
            console.warn('⚠️ 캔버스 경계 밖:', canvasPos);
            this.uiManager.showNotification('경고', '캔버스 영역 내에만 요소를 생성할 수 있습니다.', 'warning');
            return;
        }
        
        console.log('✅ 요소 생성 시작:', { tool: this.currentTool, pos: canvasPos });
        
        if (this.currentTool === 'building') {
            this.createBuilding(canvasPos.x, canvasPos.y);
        } else if (this.currentTool === 'room') {
            this.createRoom(canvasPos.x, canvasPos.y);
        } else if (this.currentTool === 'toilet') {
            this.createToilet(canvasPos.x, canvasPos.y);
        } else if (this.currentTool === 'elevator') {
            this.createElevator(canvasPos.x, canvasPos.y);
        }
        
        console.log('✅ 요소 생성 완료');
    }
    
    /**
     * 캔버스 마우스 다운 처리 (도형만)
     */
    handleCanvasMouseDown(e) {
        if (!this.currentTool) return;
        
        // 도형 도구만 처리 (현관, 계단 포함)
        if (!['rectangle', 'circle', 'line', 'dashed-line', 'entrance', 'stairs'].includes(this.currentTool)) {
            return;
        }
        
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        // 캔버스 경계 체크
        if (!this.isWithinCanvasBounds(canvasPos.x, canvasPos.y)) {
            this.uiManager.showNotification('경고', '캔버스 영역 내에만 요소를 생성할 수 있습니다.', 'warning');
            return;
        }
        
        this.startDrawingShape(canvasPos.x, canvasPos.y);
        console.log('✏️ 도형 그리기 시작:', this.currentTool, canvasPos);
    }
    
    /**
     * 캔버스 경계 내부인지 확인
     */
    isWithinCanvasBounds(x, y, width = 0, height = 0) {
        const canvasWidth = this.core.state.canvasWidth;
        const canvasHeight = this.core.state.canvasHeight;
        
        return x >= 0 && y >= 0 && 
               (x + width) <= canvasWidth && 
               (y + height) <= canvasHeight;
    }
    
    /**
     * 캔버스 마우스 이동 처리
     */
    handleCanvasMouseMove(e) {
        if (!this.isDrawing) return;
        
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        // 도형 프리뷰 업데이트
        this.updateShapePreview(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 캔버스 마우스 업 처리
     */
    handleCanvasMouseUp(e) {
        if (!this.isDrawing) return;
        
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        this.finishDrawingShape(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 건물 생성
     */
    createBuilding(x, y) {
        const name = prompt('건물 이름을 입력하세요:', '새건물');
        if (!name) return;
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 건물 요소 생성 (커스텀 크기 사용)
        const buildingWidth = this.customElementWidth;
        const buildingHeight = this.customElementHeight;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const buildingX = x - buildingWidth / 2;
        const buildingY = y - buildingHeight / 2;
        
        console.log('🏢 건물 생성 시작 - 현재 색상:', {
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth
        });
        
        const building = this.elementManager.createElement('building', {
            xCoordinate: buildingX,
            yCoordinate: buildingY,
            width: buildingWidth,
            height: buildingHeight,
            label: name,
            borderColor: this.currentColor,  // 현재 선택된 선 색상
            backgroundColor: this.currentFillColor,  // 현재 선택된 채우기 색상
            borderWidth: this.currentLineWidth,
            zIndex: 0  // 건물은 기본 레이어
        });
        
        console.log('🏢 건물 생성 완료:', building);
        
        // 이름박스 자동 생성 (건물 상단 중앙) - 기본 크기 사용
        const nameBoxWidth = this.defaultNameBoxWidth || 160;
        const nameBoxHeight = this.defaultNameBoxHeight || 40;
        this.elementManager.createElement('name_box', {
            xCoordinate: buildingX + (buildingWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: buildingY + 25,  // 상단에서 25px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            // backgroundColor, borderColor, borderWidth 제거 (투명하게 렌더링)
            parentElementId: building.id,
            zIndex: 0  // 건물과 동일한 레이어
        });
        
        this.selectTool(null);
    }
    
    /**
     * 교실 생성
     */
    createRoom(x, y) {
        const name = prompt('교실 이름을 입력하세요:', '새교실');
        if (!name) return;
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 교실 요소 생성 (커스텀 크기 사용)
        const roomWidth = this.customElementWidth;
        const roomHeight = this.customElementHeight;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const roomX = x - roomWidth / 2;
        const roomY = y - roomHeight / 2;
        
        console.log('🚪 교실 생성 시작 - 현재 색상:', {
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth
        });
        
        const room = this.elementManager.createElement('room', {
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: roomWidth,
            height: roomHeight,
            label: name,
            borderColor: this.currentColor,  // 현재 선택된 선 색상
            backgroundColor: this.currentFillColor,  // 현재 선택된 채우기 색상
            borderWidth: this.currentLineWidth,
            zIndex: 2  // 교실은 도형보다 위 (건물:0, 도형:1, 교실:2)
        });
        
        console.log('🚪 교실 생성 완료:', room);
        
        // 이름박스 자동 생성 (교실 상단 중앙) - 기본 크기 사용
        const nameBoxWidth = this.defaultNameBoxWidth || 160;
        const nameBoxHeight = this.defaultNameBoxHeight || 40;
        this.elementManager.createElement('name_box', {
            xCoordinate: roomX + (roomWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: roomY + 40,  // 상단에서 40px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            // backgroundColor, borderColor, borderWidth 제거 (투명하게 렌더링)
            parentElementId: room.id,
            zIndex: 2  // 교실과 동일한 레이어
        });
        
        this.selectTool(null);
    }
    
    /**
     * 화장실 생성 (아이콘 표시)
     */
    createToilet(x, y) {
        // 히스토리 저장
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 화장실 크기 (교실의 절반 너비)
        const toiletWidth = 140;   // 280 / 2
        const toiletHeight = 180;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const toiletX = x - toiletWidth / 2;
        const toiletY = y - toiletHeight / 2;
        
        // 화장실 요소 생성 (특수 타입 - 아이콘 표시)
        this.elementManager.createElement('toilet', {
            xCoordinate: toiletX,
            yCoordinate: toiletY,
            width: toiletWidth,
            height: toiletHeight,
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth,
            zIndex: 2
        });
        
        this.selectTool(null);
    }
    
    /**
     * 엘리베이터 생성 (아이콘 표시)
     */
    createElevator(x, y) {
        // 히스토리 저장
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // EV 크기 (교실의 절반 너비)
        const evWidth = 140;   // 280 / 2
        const evHeight = 180;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const evX = x - evWidth / 2;
        const evY = y - evHeight / 2;
        
        // EV 요소 생성 (특수 타입 - 아이콘 표시)
        this.elementManager.createElement('elevator', {
            xCoordinate: evX,
            yCoordinate: evY,
            width: evWidth,
            height: evHeight,
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth,
            zIndex: 2
        });
        
        this.selectTool(null);
    }
    
    /**
     * 현관 생성 (아이콘 표시)
     */
    createEntrance(x, y) {
        // 히스토리 저장
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 현관 크기 (교실의 절반 너비)
        const entranceWidth = 140;   // 280 / 2
        const entranceHeight = 180;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const entranceX = x - entranceWidth / 2;
        const entranceY = y - entranceHeight / 2;
        
        // 현관 요소 생성 (특수 타입 - 아이콘 표시)
        this.elementManager.createElement('entrance', {
            xCoordinate: entranceX,
            yCoordinate: entranceY,
            width: entranceWidth,
            height: entranceHeight,
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth,
            zIndex: 2
        });
        
        this.selectTool(null);
    }
    
    /**
     * 계단 생성 (시각적 표현, 이름박스 없음)
     */
    createStairs(x, y) {
        // 히스토리 저장
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 계단 크기 (교실의 절반 너비)
        const stairsWidth = 140;   // 280 / 2
        const stairsHeight = 180;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const stairsX = x - stairsWidth / 2;
        const stairsY = y - stairsHeight / 2;
        
        // 계단 요소 생성 (특수 타입)
        this.elementManager.createElement('stairs', {
            xCoordinate: stairsX,
            yCoordinate: stairsY,
            width: stairsWidth,
            height: stairsHeight,
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth,
            zIndex: 2
        });
        
        this.selectTool(null);
    }
    
    /**
     * 도형 그리기 시작
     */
    startDrawingShape(x, y) {
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        this.isDrawing = true;
        this.drawStartPos = { x, y };
    }
    
    /**
     * 도형 프리뷰 업데이트
     */
    updateShapePreview(x, y) {
        if (!this.drawStartPos) return;
        
        const width = Math.abs(x - this.drawStartPos.x);
        const height = Math.abs(y - this.drawStartPos.y);
        
        // 선/점선의 경우 실제 드래그 방향 유지
        const previewData = {
            shapeType: this.currentTool,
            startX: this.drawStartPos.x,
            startY: this.drawStartPos.y,
            endX: x,
            endY: y,
            width: width,
            height: height,
            borderColor: this.currentColor,
            borderWidth: this.currentLineWidth,
            backgroundColor: this.currentTool === 'line' || this.currentTool === 'dashed-line' ? 'transparent' : this.currentFillColor
        };
        
        // 일반 도형은 정규화된 사각형 좌표로 조정
        if (this.currentTool !== 'line' && this.currentTool !== 'dashed-line') {
            previewData.startX = Math.min(this.drawStartPos.x, x);
            previewData.startY = Math.min(this.drawStartPos.y, y);
        }
        
        // Core의 drawingShape 상태 업데이트 (실시간 프리뷰)
        this.core.updateDrawingShape(previewData);
        
        this.core.markDirty();
    }
    
    /**
     * 도형 그리기 완료
     */
    finishDrawingShape(x, y) {
        if (!this.drawStartPos) return;
        
        const width = Math.abs(x - this.drawStartPos.x);
        const height = Math.abs(y - this.drawStartPos.y);
        
        // 선/점선의 경우 선의 길이로 체크, 일반 도형은 width와 height 체크
        if (this.currentTool === 'line' || this.currentTool === 'dashed-line') {
            // 선의 길이 계산 (피타고라스 정리)
            const lineLength = Math.sqrt(width * width + height * height);
            if (lineLength < 5) {
                this.isDrawing = false;
                this.drawStartPos = null;
                this.core.updateDrawingShape(null); // 프리뷰 제거
                this.core.markDirty();
                return;
            }
        } else {
            // 일반 도형: width와 height 모두 체크
            if (width < 5 || height < 5) {
                this.isDrawing = false;
                this.drawStartPos = null;
                this.core.updateDrawingShape(null); // 프리뷰 제거
                this.core.markDirty();
                return;
            }
        }
        
        // 실제 도형 요소 생성
        console.log('📐 도형 생성 시작 - 현재 색상:', {
            tool: this.currentTool,
            borderColor: this.currentColor,
            backgroundColor: this.currentFillColor,
            borderWidth: this.currentLineWidth
        });
        
        const elementData = {
            shapeType: this.currentTool,
            xCoordinate: Math.min(this.drawStartPos.x, x),
            yCoordinate: Math.min(this.drawStartPos.y, y),
            width: width,
            height: height,
            borderColor: this.currentColor,
            borderWidth: this.currentLineWidth,
            backgroundColor: this.currentTool === 'line' || this.currentTool === 'dashed-line' ? 'transparent' : this.currentFillColor,
            zIndex: 1  // 도형은 건물보다 위, 교실보다 아래
        };
        
        // 선/점선의 경우 시작점과 끝점 저장
        if (this.currentTool === 'line' || this.currentTool === 'dashed-line') {
            elementData.startX = this.drawStartPos.x;
            elementData.startY = this.drawStartPos.y;
            elementData.endX = x;
            elementData.endY = y;
        }
        
        // 현관, 계단의 경우 전용 타입으로 생성
        let elementType = 'shape';
        if (this.currentTool === 'entrance') {
            elementType = 'entrance';
            elementData.rotation = 180;  // 기본 180도 회전 (캐시 우회)
        } else if (this.currentTool === 'stairs') {
            elementType = 'stairs';
        }
        const createdElement = this.elementManager.createElement(elementType, elementData);
        console.log('📐 도형 생성 완료:', createdElement);
        
        // 그리기 상태 초기화
        this.isDrawing = false;
        this.drawStartPos = null;
        this.core.updateDrawingShape(null); // 프리뷰 제거
        this.selectTool(null);
        
        console.log('📐 도형 생성 완료:', this.currentTool, width, 'x', height);
    }
    
    /**
     * 다음 레이어 순서 얻기
     */
    getNextLayerOrder() {
        const elements = this.elementManager.getAllElements();
        if (elements.length === 0) return 0;
        
        const maxOrder = Math.max(...elements.map(e => e.layerOrder || 0));
        return maxOrder + 1;
    }
    
    /**
     * 앞으로 가져오기
     */
    bringForward() {
        const selectedElements = this.core.state.selectedElements || [];
        if (selectedElements.length === 0) return;
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        selectedElements.forEach(element => {
            this.elementManager.bringForward(element.id);
        });
        
        this.core.markDirty();
        console.log('⬆️ 요소를 앞으로 이동:', selectedElements.length, '개');
    }
    
    /**
     * 뒤로 보내기
     */
    sendBackward() {
        const selectedElements = this.core.state.selectedElements || [];
        if (selectedElements.length === 0) return;
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        selectedElements.forEach(element => {
            this.elementManager.sendBackward(element.id);
        });
        
        this.core.markDirty();
        console.log('⬇️ 요소를 뒤로 이동:', selectedElements.length, '개');
    }
    
    /**
     * 캔버스 초기화
     */
    async initializeCanvas() {
        const confirmed = confirm(
            '경고: 현재 캔버스의 모든 요소가 삭제됩니다.\n' +
            '이 작업은 되돌릴 수 없습니다.\n\n' +
            '정말 초기화하시겠습니까?'
        );
        
        if (!confirmed) return;
        
        try {
            // 1. 삭제될 교실 정보 수집 (미배치 리스트 복원용)
            const roomElements = this.core.state.elements.filter(
                el => el.elementType === 'room' && el.classroomId
            );
            
            console.log('🗑️ 캔버스 초기화: 교실 요소', roomElements.length, '개 삭제 예정');
            
            // 2. 서버에 초기화 요청
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/initialize`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 3. 캔버스 초기화
                this.elementManager.clearAllElements();
                
                // 4. 배치된 교실 추적 초기화 (모든 교실을 미배치로)
                if (this.placedClassroomIds) {
                    roomElements.forEach(room => {
                        const classroomId = String(room.classroomId);
                        this.placedClassroomIds.delete(classroomId);
                        console.log('🔄 교실 미배치로 복원:', classroomId, '/', room.label);
                    });
                }
                
                // 5. 미배치 교실 목록 갱신
                this.refreshUnplacedList();
                
                this.uiManager.showNotification('캔버스가 초기화되었습니다', 'success');
                this.core.markDirty();
                
                console.log('✅ 캔버스 초기화 완료 - 미배치 교실 목록 갱신됨');
            } else {
                this.uiManager.showNotification('초기화 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('캔버스 초기화 오류:', error);
            this.uiManager.showNotification('초기화 중 오류가 발생했습니다', 'error');
        }
    }
    
    /**
     * 미배치 교실 로드
     */
    async loadUnplacedClassrooms(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/schools/${schoolId}/unplaced-classrooms`);
            const result = await response.json();
            
            if (result.success) {
                console.log('📚 미배치 교실:', result.classrooms?.length || 0, '개');
                this.renderUnplacedClassrooms(result.classrooms || []);
            } else {
                console.warn('📚 미배치 교실 로드 실패:', result.message);
                this.renderUnplacedClassrooms([]);
            }
        } catch (error) {
            console.error('❌ 미배치 교실 로드 오류:', error);
            this.renderUnplacedClassrooms([]);
        }
    }
    
    /**
     * 미배치 교실 렌더링
     */
    renderUnplacedClassrooms(classrooms) {
        const container = document.getElementById('unplaced-classrooms-list');
        if (!container) {
            console.warn('📚 미배치 교실 컨테이너를 찾을 수 없습니다');
            return;
        }
        
        // 원본 교실 목록 저장 (refreshUnplacedList용)
        this.originalClassrooms = classrooms || [];
        
        // 로드된 교실 데이터 병합 (삭제 후 복원용)
        if (this.loadedClassroomData && this.loadedClassroomData.length > 0) {
            // 중복 제거: originalClassrooms에 없는 로드된 교실만 추가
            this.loadedClassroomData.forEach(loadedClassroom => {
                const exists = this.originalClassrooms.some(c => 
                    String(c.classroomId || c.id) === String(loadedClassroom.classroomId)
                );
                if (!exists) {
                    this.originalClassrooms.push(loadedClassroom);
                    console.log('➕ 로드된 교실 추가:', loadedClassroom.classroomId, '/', loadedClassroom.roomName);
                }
            });
        }
        
        console.log('📚 전체 교실 목록 (원본 + 로드됨):', this.originalClassrooms.length, '개');
        
        // 배치된 교실 ID가 없으면 초기화
        if (!this.placedClassroomIds) {
            this.placedClassroomIds = new Set();
        }
        
        // 이미 배치된 교실 필터링 (병합된 전체 목록에서)
        const unplacedClassrooms = this.originalClassrooms.filter(classroom => {
            const id = String(classroom.classroomId || classroom.id || classroom.classroom_id);
            const isUnplaced = !this.placedClassroomIds.has(id);
            console.log(`📋 교실 필터링: ID=${id}, 배치여부=${!isUnplaced}, 미배치=${isUnplaced}`);
            return isUnplaced;
        });
        
        console.log(`📊 필터링 결과: 전체 ${this.originalClassrooms.length}개 → 미배치 ${unplacedClassrooms.length}개`);
        
        if (!unplacedClassrooms || unplacedClassrooms.length === 0) {
            container.innerHTML = '<p class="empty">모든 교실이 배치되었습니다</p>';
            console.log('✅ DOM 업데이트 완료 (모든 교실 배치됨)');
            return;
        }
        
        // 가나다 순으로 정렬
        const sortedClassrooms = [...unplacedClassrooms].sort((a, b) => {
            const nameA = a.roomName || a.classroomName || a.name || '';
            const nameB = b.roomName || b.classroomName || b.name || '';
            return nameA.localeCompare(nameB, 'ko-KR');
        });
        
        container.innerHTML = sortedClassrooms.map(classroom => {
            // Classroom 엔티티의 실제 필드명 사용
            const id = classroom.classroomId || classroom.id || classroom.classroom_id;
            const name = classroom.roomName || classroom.classroomName || classroom.name || classroom.className || classroom.class_name || `교실 ${id}`;
            
            return `
                <div class="unplaced-classroom-item" 
                     data-classroom-id="${id}"
                     data-classroom-name="${name}">
                    <span>${name}</span>
                </div>
            `;
        }).join('');
        
        console.log(`✅ DOM 업데이트 완료: ${sortedClassrooms.length}개 교실 렌더링됨`);
        
        // 클릭 이벤트 설정
        this.setupClassroomClickEvents();
        console.log('✅ 클릭 이벤트 재설정 완료');
    }
    
    /**
     * 미배치 교실 목록 새로고침 (배치된 교실 제외)
     */
    refreshUnplacedList() {
        console.log('🔄 refreshUnplacedList 호출됨');
        if (this.originalClassrooms) {
            console.log('📚 원본 교실 목록:', this.originalClassrooms.length, '개');
            console.log('📍 배치된 교실 ID:', Array.from(this.placedClassroomIds || []));
            this.renderUnplacedClassrooms(this.originalClassrooms);
        } else {
            console.warn('⚠️ originalClassrooms가 없음');
        }
    }
    
    /**
     * 교실 클릭 이벤트 설정 (드래그 앤 드롭 → 클릭 방식으로 변경)
     */
    setupClassroomClickEvents() {
        // 기존 이벤트 리스너 제거 (중복 방지)
        document.querySelectorAll('.unplaced-classroom-item').forEach(item => {
            // 기존 클릭 리스너 제거
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // 미배치 교실 항목 클릭 이벤트
        document.querySelectorAll('.unplaced-classroom-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const classroomId = item.dataset.classroomId;
                const classroomName = item.dataset.classroomName;
                
                // 선택된 교실 저장 (건물/교실 도구처럼)
                this.selectedUnplacedClassroom = {
                    classroomId: classroomId,
                    classroomName: classroomName
                };
                
                // 시각적 피드백 (선택된 항목 강조)
                document.querySelectorAll('.unplaced-classroom-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                
                // 커서를 crosshair로 변경 (건물/교실 도구처럼)
                if (this.core && this.core.canvas) {
                    this.core.canvas.style.cursor = 'crosshair';
                }
                
                console.log('✅ 미배치 교실 선택:', { classroomId, classroomName });
                console.log('💡 이제 캔버스를 클릭하여 교실을 배치하세요');
            });
        });
    }
    
    /**
     * 교실 배치 (프론트엔드에서만 처리, 저장 버튼 클릭 시 백엔드에 저장)
     */
    placeClassroom(classroomId, classroomName, x, y) {
        // 배치된 교실 ID 추적 초기화
        if (!this.placedClassroomIds) {
            this.placedClassroomIds = new Set();
        }
        
        // 이미 배치된 교실인지 확인
        if (this.placedClassroomIds.has(classroomId)) {
            console.warn('⚠️ 이미 배치된 교실:', classroomId);
            return;
        }
        
        // 교실 요소 생성 (커스텀 크기 사용)
        const roomWidth = this.customElementWidth;
        const roomHeight = this.customElementHeight;
        const roomX = Math.round(x - roomWidth / 2);
        const roomY = Math.round(y - roomHeight / 2);
        
        // 캔버스에 교실 요소 생성
        const room = this.elementManager.createElement('room', {
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: roomWidth,
            height: roomHeight,
            label: classroomName,
            borderColor: this.currentColor,  // 현재 선택된 선 색상
            backgroundColor: this.currentFillColor,  // 현재 선택된 채우기 색상
            borderWidth: this.currentLineWidth,
            classroomId: classroomId,  // 교실 ID 저장 (좌표 업데이트 시 사용)
            referenceId: classroomId,  // 평면도 저장/로드 시 교실 연결용
            zIndex: 2  // 교실은 도형보다 위 (건물:0, 도형:1, 교실:2)
        });
        
        // 이름박스 자동 생성 - 기본 크기 사용
        const nameBoxWidth = this.defaultNameBoxWidth || 160;
        const nameBoxHeight = this.defaultNameBoxHeight || 40;
        this.elementManager.createElement('name_box', {
            xCoordinate: roomX + (roomWidth - nameBoxWidth) / 2,
            yCoordinate: roomY + 40,  // 상단에서 40px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: classroomName,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 1,
            fontSize: 18,  // 16 → 18 (+2px)
            parentElementId: room.id,
            zIndex: 2  // 교실과 동일한 레이어
        });
        
        // 배치된 교실 ID 추적 (미배치 리스트 필터링용)
        this.placedClassroomIds.add(classroomId);
        
        console.log('✅ 교실 배치 완료:', { classroomId, classroomName, 배치된교실수: this.placedClassroomIds.size });
        
        // 미배치 교실 목록 갱신 (배치된 교실 필터링)
        this.refreshUnplacedList();
    }
    
    /**
     * 요소 삭제 후 처리 (미배치 교실 복원)
     */
    onElementsDeleted(deletedElements) {
        console.log('🗑️ onElementsDeleted 호출됨:', deletedElements?.length || 0, '개');
        
        if (!this.placedClassroomIds) {
            console.warn('⚠️ placedClassroomIds가 초기화되지 않음');
            return;
        }
        
        let needRefresh = false;
        const restoredClassrooms = [];
        
        // 삭제된 요소 중 교실이 있는지 확인
        deletedElements.forEach(element => {
            console.log('🔍 삭제된 요소 확인:', { 
                elementType: element.elementType, 
                classroomId: element.classroomId,
                label: element.label 
            });
            
            if (element.elementType === 'room' && element.classroomId) {
                const classroomId = String(element.classroomId);
                if (this.placedClassroomIds.has(classroomId)) {
                    // 배치 추적에서 제거
                    this.placedClassroomIds.delete(classroomId);
                    needRefresh = true;
                    restoredClassrooms.push(classroomId);
                    console.log('🔄 교실 배치 해제:', classroomId, '/', element.label);
                }
            }
        });
        
        // 미배치 교실 목록 갱신
        if (needRefresh) {
            console.log('✅ 교실 복원 중:', restoredClassrooms);
            this.refreshUnplacedList();
            console.log('✅ 미배치 교실 목록 갱신 완료 (현재 배치된 교실 수:', this.placedClassroomIds.size, ')');
        } else {
            console.log('ℹ️ 복원할 교실 없음');
        }
    }
    
    /**
     * 선택 해제
     */
    clearSelection() {
        this.selectedElements = [];
        this.updateLayerButtons();
    }
    
    /**
     * 모든 요소 잠금 해제
     */
    unlockAllElements() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            element.isLocked = false;
        });
    }
    
    /**
     * 도구 선택 UI 업데이트
     */
    updateToolSelection() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    /**
     * 레이어 버튼 업데이트 (헤더)
     */
    updateLayerButtons() {
        const bringForward = document.getElementById('header-bring-forward');
        const sendBackward = document.getElementById('header-send-backward');
        
        // core의 선택 상태 확인
        const hasSelection = this.core.state.selectedElements && this.core.state.selectedElements.length > 0;
        
        if (bringForward) bringForward.disabled = !hasSelection;
        if (sendBackward) sendBackward.disabled = !hasSelection;
        
        console.debug('🎚️ 레이어 버튼 업데이트:', hasSelection ? '활성화' : '비활성화', '(선택:', this.core.state.selectedElements.length, '개)');
    }
}

