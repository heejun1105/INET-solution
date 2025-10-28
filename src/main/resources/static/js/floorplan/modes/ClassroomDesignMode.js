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
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.currentTool = null; // 'building', 'room', 'rectangle', 'circle', 'line', 'dashed-line'
        this.currentColor = '#000000';
        this.currentLineWidth = 2;
        this.currentFillColor = '#ffffff';  // 흰색
        
        this.selectedElements = [];
        this.isDrawing = false;
        this.drawStartPos = null;
        
        console.log('📐 ClassroomDesignMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    activate() {
        console.log('✅ 교실설계 모드 활성화');
        this.setupUI();
        this.bindEvents();
        this.setupHeaderTools(); // 헤더 도구 설정
        
        // 헤더 도구 표시
        const headerTools = document.getElementById('workspace-tools');
        if (headerTools) {
            headerTools.style.display = 'flex';
        }
        
        // 모든 요소 잠금 해제
        this.unlockAllElements();
        
        // 레이어 버튼 초기 상태 설정
        this.updateLayerButtons();
        
        // 선택 상태 변경 감지를 위한 주기적 체크
        this.selectionCheckInterval = setInterval(() => {
            this.updateLayerButtons();
        }, 200); // 200ms마다 체크
        
        // 캔버스에 이미 배치된 교실 ID 추적
        this.placedClassroomIds = new Set();
        const roomElements = this.core.state.elements.filter(el => el.shapeType === 'room' && el.classroomId);
        roomElements.forEach(room => {
            this.placedClassroomIds.add(String(room.classroomId));
        });
        console.log('📍 이미 배치된 교실:', this.placedClassroomIds.size, '개');
        
        // 미배치 교실 로드
        if (this.core.currentSchoolId) {
            this.loadUnplacedClassrooms(this.core.currentSchoolId);
        }
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 교실설계 모드 비활성화');
        
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
            
            // 저장된 상태 불러오기
            const isCollapsed = localStorage.getItem('toolbar-collapsed') === 'true';
            if (isCollapsed) {
                toolbarContainer.classList.add('collapsed');
            }
            
            // 토글 이벤트
            toggleBtn.addEventListener('click', () => {
                toolbarContainer.classList.toggle('collapsed');
                const collapsed = toolbarContainer.classList.contains('collapsed');
                localStorage.setItem('toolbar-collapsed', collapsed);
            });
        }
        
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <h3>요소 생성</h3>
                <div class="tool-buttons">
                    <button class="tool-btn" data-tool="building" title="건물 추가">
                        <i class="fas fa-building"></i> 건물
                    </button>
                    <button class="tool-btn" data-tool="room" title="교실 추가">
                        <i class="fas fa-door-open"></i> 교실
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
        // 스타일 컨트롤
        const lineColorInput = document.getElementById('header-line-color');
        if (lineColorInput) {
            lineColorInput.value = this.currentColor;
            lineColorInput.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
            });
        }
        
        const fillColorInput = document.getElementById('header-fill-color');
        if (fillColorInput) {
            fillColorInput.value = this.currentFillColor;
            fillColorInput.addEventListener('change', (e) => {
                this.currentFillColor = e.target.value;
            });
        }
        
        const lineWidthSelect = document.getElementById('header-line-width');
        if (lineWidthSelect) {
            lineWidthSelect.value = this.currentLineWidth.toString();
            lineWidthSelect.addEventListener('change', (e) => {
                this.currentLineWidth = parseInt(e.target.value);
            });
        }
        
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
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 도움말 메뉴가 열려있으면 닫기
                const helpMenu = document.getElementById('help-menu');
                if (helpMenu) helpMenu.style.display = 'none';
                moreMenu.style.display = moreMenu.style.display === 'none' ? 'block' : 'none';
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', () => {
                moreMenu.style.display = 'none';
            });
        }
        
        // 캔버스 초기화
        const initBtn = document.getElementById('header-initialize-canvas');
        if (initBtn) {
            initBtn.addEventListener('click', () => {
                moreMenu.style.display = 'none';
                this.initializeCanvas();
            });
        }
        
        // 도움말 드롭다운
        const helpBtn = document.getElementById('help-btn');
        const helpMenu = document.getElementById('help-menu');
        if (helpBtn && helpMenu) {
            helpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 추가 기능 메뉴가 열려있으면 닫기
                if (moreMenu) moreMenu.style.display = 'none';
                helpMenu.style.display = helpMenu.style.display === 'none' ? 'block' : 'none';
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', () => {
                helpMenu.style.display = 'none';
            });
            
            // 메뉴 내부 클릭 시 닫히지 않도록
            helpMenu.addEventListener('click', (e) => {
                e.stopPropagation();
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
        
        const canvas = this.core.canvas;
        canvas.addEventListener('click', this.canvasClickHandler);
        canvas.addEventListener('mousedown', this.canvasMouseDownHandler);
        canvas.addEventListener('mousemove', this.canvasMouseMoveHandler);
        canvas.addEventListener('mouseup', this.canvasMouseUpHandler);
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
    }
    
    /**
     * 도구 선택
     */
    selectTool(tool) {
        this.currentTool = tool;
        
        // Core 상태 업데이트 (InteractionManager가 커서를 변경하지 않도록)
        this.core.setState({ activeTool: tool });
        
        // UI 업데이트
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
        
        // 커서 스타일 변경
        if (this.currentTool) {
            this.core.canvas.style.cursor = 'crosshair';
        } else {
            this.core.canvas.style.cursor = 'default';
        }
    }
    
    /**
     * 캔버스 클릭 처리 (건물, 교실만)
     */
    handleCanvasClick(e) {
        if (!this.currentTool) return;
        
        // 도형은 mousedown/drag로 처리하므로 여기서는 제외
        if (['rectangle', 'circle', 'line', 'dashed-line'].includes(this.currentTool)) {
            return;
        }
        
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        // 캔버스 경계 체크
        if (!this.isWithinCanvasBounds(canvasPos.x, canvasPos.y)) {
            this.uiManager.showNotification('경고', '캔버스 영역 내에만 요소를 생성할 수 있습니다.', 'warning');
            return;
        }
        
        if (this.currentTool === 'building') {
            this.createBuilding(canvasPos.x, canvasPos.y);
        } else if (this.currentTool === 'room') {
            this.createRoom(canvasPos.x, canvasPos.y);
        }
    }
    
    /**
     * 캔버스 마우스 다운 처리 (도형만)
     */
    handleCanvasMouseDown(e) {
        if (!this.currentTool) return;
        
        // 도형 도구만 처리
        if (!['rectangle', 'circle', 'line', 'dashed-line'].includes(this.currentTool)) {
            return;
        }
        
        // InteractionManager의 드래그와 충돌하지 않도록 이벤트 전파 중단
        e.stopPropagation();
        
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
        
        // 건물 요소 생성 (크기 5배)
        const buildingWidth = 400;
        const buildingHeight = 750;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const buildingX = x - buildingWidth / 2;
        const buildingY = y - buildingHeight / 2;
        
        const building = this.elementManager.createElement('building', {
            xCoordinate: buildingX,
            yCoordinate: buildingY,
            width: buildingWidth,
            height: buildingHeight,
            label: name,
            borderColor: '#000000',  // 검정 테두리
            backgroundColor: '#ffffff',  // 흰색 배경
            borderWidth: this.currentLineWidth,
            zIndex: 0  // 건물은 기본 레이어
        });
        
        // 이름박스 자동 생성 (건물 상단 중앙)
        const nameBoxWidth = 150;
        const nameBoxHeight = 40;
        this.elementManager.createElement('name_box', {
            xCoordinate: buildingX + (buildingWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: buildingY + 25,  // 상단에서 25px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 2,
            fontSize: 16,
            parentElementId: building.id,
            zIndex: 0  // 건물과 동일한 레이어
        });
        
        this.selectTool(null);
        
        console.log('🏢 건물 생성:', name);
    }
    
    /**
     * 교실 생성
     */
    createRoom(x, y) {
        const name = prompt('교실 이름을 입력하세요:', '새교실');
        if (!name) return;
        
        // 교실 요소 생성
        const roomWidth = 120;
        const roomHeight = 100;
        
        // 클릭한 위치가 중앙이 되도록 조정
        const roomX = x - roomWidth / 2;
        const roomY = y - roomHeight / 2;
        
        const room = this.elementManager.createElement('room', {
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: roomWidth,
            height: roomHeight,
            label: name,
            borderColor: '#000000',  // 검정 테두리
            backgroundColor: '#ffffff',  // 흰색 배경
            borderWidth: this.currentLineWidth,
            zIndex: 2  // 교실은 도형보다 위 (건물:0, 도형:1, 교실:2)
        });
        
        // 이름박스 자동 생성 (교실 상단 중앙)
        const nameBoxWidth = 80;
        const nameBoxHeight = 25;
        this.elementManager.createElement('name_box', {
            xCoordinate: roomX + (roomWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: roomY + 20,  // 상단에서 20px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 1,
            fontSize: 12,
            parentElementId: room.id,
            zIndex: 2  // 교실과 동일한 레이어
        });
        
        this.selectTool(null);
        
        console.log('🚪 교실 생성:', name);
    }
    
    /**
     * 도형 그리기 시작
     */
    startDrawingShape(x, y) {
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
        
        // Core의 drawingShape 상태 업데이트 (실시간 프리뷰)
        this.core.updateDrawingShape({
            shapeType: this.currentTool,
            startX: Math.min(this.drawStartPos.x, x),
            startY: Math.min(this.drawStartPos.y, y),
            endX: Math.max(this.drawStartPos.x, x),
            endY: Math.max(this.drawStartPos.y, y),
            width: width,
            height: height,
            borderColor: this.currentColor,
            borderWidth: this.currentLineWidth,
            backgroundColor: this.currentTool === 'line' || this.currentTool === 'dashed-line' ? 'transparent' : this.currentFillColor
        });
        
        this.core.markDirty();
    }
    
    /**
     * 도형 그리기 완료
     */
    finishDrawingShape(x, y) {
        if (!this.drawStartPos) return;
        
        const width = Math.abs(x - this.drawStartPos.x);
        const height = Math.abs(y - this.drawStartPos.y);
        
        // 너무 작은 도형은 생성하지 않음
        if (width < 5 || height < 5) {
            this.isDrawing = false;
            this.drawStartPos = null;
            this.core.updateDrawingShape(null); // 프리뷰 제거
            this.core.markDirty();
            return;
        }
        
        // 실제 도형 요소 생성
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
        
        this.elementManager.createElement('shape', elementData);
        
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
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/initialize`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.elementManager.clearAllElements();
                this.uiManager.showNotification('캔버스가 초기화되었습니다', 'success');
                this.core.markDirty();
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
        
        // 배치된 교실 ID가 없으면 초기화
        if (!this.placedClassroomIds) {
            this.placedClassroomIds = new Set();
        }
        
        // 이미 배치된 교실 필터링
        const unplacedClassrooms = classrooms.filter(classroom => {
            const id = String(classroom.classroomId || classroom.id || classroom.classroom_id);
            return !this.placedClassroomIds.has(id);
        });
        
        if (!unplacedClassrooms || unplacedClassrooms.length === 0) {
            container.innerHTML = '<p class="empty">모든 교실이 배치되었습니다</p>';
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
                <div class="unplaced-classroom-item" draggable="true" 
                     data-classroom-id="${id}"
                     data-classroom-name="${name}">
                    <i class="fas fa-grip-vertical"></i>
                    <span>${name}</span>
                </div>
            `;
        }).join('');
        
        // 드래그 이벤트 설정
        this.setupClassroomDragEvents();
    }
    
    /**
     * 미배치 교실 목록 새로고침 (배치된 교실 제외)
     */
    refreshUnplacedList() {
        if (this.originalClassrooms) {
            this.renderUnplacedClassrooms(this.originalClassrooms);
        }
    }
    
    /**
     * 교실 드래그 이벤트 설정
     */
    setupClassroomDragEvents() {
        document.querySelectorAll('.unplaced-classroom-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const classroomId = item.dataset.classroomId;
                const classroomName = item.dataset.classroomName;
                e.dataTransfer.setData('classroomId', classroomId);
                e.dataTransfer.setData('classroomName', classroomName);
                e.dataTransfer.effectAllowed = 'move';
                console.log('🎯 드래그 시작:', { classroomId, classroomName });
            });
        });
        
        // 캔버스에 드롭 이벤트 설정 (중복 방지)
        if (!this.canvasDragDropSetup) {
            const canvas = this.core.canvas;
            
            canvas.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const classroomId = e.dataTransfer.getData('classroomId');
                const classroomName = e.dataTransfer.getData('classroomName');
                
                console.log('🎯 드롭:', { classroomId, classroomName });
                
                if (classroomId && classroomName) {
                    const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
                    this.placeClassroom(classroomId, classroomName, canvasPos.x, canvasPos.y);
                }
            });
            
            this.canvasDragDropSetup = true;
        }
    }
    
    /**
     * 교실 배치 (프론트엔드에서만 처리, 저장 버튼 클릭 시 백엔드에 저장)
     */
    placeClassroom(classroomId, classroomName, x, y) {
        // 교실 요소 생성 (중앙 정렬)
        const roomWidth = 120;
        const roomHeight = 100;
        const roomX = Math.round(x - roomWidth / 2);
        const roomY = Math.round(y - roomHeight / 2);
        
        // 캔버스에 교실 요소 생성
        const room = this.elementManager.createElement('room', {
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: roomWidth,
            height: roomHeight,
            label: classroomName,
            borderColor: '#000000',
            backgroundColor: '#ffffff',
            borderWidth: 2,
            classroomId: classroomId,  // 교실 ID 저장 (좌표 업데이트 시 사용)
            referenceId: classroomId,  // 평면도 저장/로드 시 교실 연결용
            zIndex: 2  // 교실은 도형보다 위 (건물:0, 도형:1, 교실:2)
        });
        
        // 이름박스 자동 생성
        const nameBoxWidth = 80;
        const nameBoxHeight = 25;
        this.elementManager.createElement('name_box', {
            xCoordinate: roomX + (roomWidth - nameBoxWidth) / 2,
            yCoordinate: roomY + 20,
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: classroomName,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 1,
            fontSize: 12,
            parentElementId: room.id,
            zIndex: 2  // 교실과 동일한 레이어
        });
        
        // 배치된 교실 ID 추적 (미배치 리스트 필터링용)
        if (!this.placedClassroomIds) {
            this.placedClassroomIds = new Set();
        }
        this.placedClassroomIds.add(classroomId);
        
        // 미배치 교실 목록 갱신 (배치된 교실 필터링)
        this.refreshUnplacedList();
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

