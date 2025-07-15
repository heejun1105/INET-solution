import ResizeManager from './ResizeManager.js';
import SnapManager from './SnapManager.js';
import ZoomManager from './ZoomManager.js';
import DragManager from './DragManager.js';
import SelectionBoxManager from './SelectionBoxManager.js';
import MultiSelectManager from './MultiSelectManager.js';
import GroupDragManager from './GroupDragManager.js';
import UnplacedRoomsManager from './UnplacedRoomsManager.js';
import NameBoxManager from './NameBoxManager.js';

export default class FloorPlanManager {
    constructor() {
        this.currentSchoolId = null;
        this.currentMode = 'layout'; // layout, device, wireless
        this.currentTool = 'select';
        this.selectedElement = null;
        this.currentShapeType = null; // 현재 선택된 도형 타입
        this.isDrawingShape = false; // 도형 그리기 중인지 여부
        this.shapeStartPoint = null; // 도형 그리기 시작점
        this.tempShapeElement = null; // 임시 도형 요소 (그리기 중)
        this.floorPlanData = {
            buildings: [],
            rooms: [],
            seats: [],
            deviceLocations: [],
            wirelessApLocations: [],
            shapes: [] // 도형 데이터 저장
        };
        this.tempIdCounter = 0;
        this.currentShapeColor = '#000000'; // 기본 색상
        this.currentShapeThickness = 2; // 기본 굵기
        this.currentBorderColor = '#000000'; // 건물 및 교실의 테두리 색상
        this.currentBorderThickness = 2; // 건물 및 교실의 테두리 굵기
        
        // 캔버스 요소 캐싱
        this.canvas = document.getElementById('canvasContent');

        this.resizeManager = new ResizeManager(this);
        this.snapManager = new SnapManager();
        
        if (this.canvas) {
            this.zoomManager = new ZoomManager(this.canvas);
        } else {
            console.warn('⚠️ canvasContent 요소를 찾을 수 없습니다. ZoomManager 초기화를 건너뜁니다.');
            this.zoomManager = null;
        }
        
        this.dragManager = new DragManager(this);
        this.unplacedRoomsManager = new UnplacedRoomsManager(this);
        this.selectionBoxManager = new SelectionBoxManager(this);
        this.multiSelectManager = new MultiSelectManager(this);
        this.groupDragManager = new GroupDragManager(this); // FloorPlanManager 인스턴스 전달
        this.nameBoxManager = new NameBoxManager(this.canvas, this.zoomManager);
        
        this.init();
    }
    
    init() {
        console.log('🚀 FloorPlanManager 초기화 시작');
        this.bindEvents();
        this.setupCanvas();
        
        this.switchMode('layout');
        this.selectTool('select');

        if (this.zoomManager) {
            this.zoomManager.setZoom(0.7);
        }
        
        // 드래그 이벤트 리스너 설정 (교실 선택기 제거)
        this.setupDragEventListeners();
    }
    
    bindEvents() {
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.target.closest('.tool-button').dataset.tool;
                this.handleToolClick(tool);
            });
        });
        
        // 도형 드롭다운 토글 처리
        const shapeButton = document.getElementById('shapeButton');
        const shapeDropdown = document.getElementById('shapeDropdown');
        
        if (shapeButton && shapeDropdown) {
            shapeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                shapeDropdown.classList.toggle('show');
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#shapeButton') && !e.target.closest('#shapeDropdown')) {
                    shapeDropdown.classList.remove('show');
                }
            });
        }
        
        // 도형 드롭다운 항목 클릭 이벤트
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const shapeType = e.currentTarget.dataset.shape;
                this.selectShape(shapeType);
                e.stopPropagation(); // 이벤트 버블링 방지
            });
        });
        
        // 도형 색상 및 굵기 선택 이벤트
        const colorSelect = document.getElementById('shapeColorSelect');
        const thicknessSelect = document.getElementById('shapeThicknessSelect');
        
        if (colorSelect) {
            colorSelect.addEventListener('change', (e) => {
                this.currentShapeColor = e.target.value;
                this.currentBorderColor = e.target.value; // 건물 및 교실의 테두리 색상도 함께 변경
                console.log(`색상 변경: ${this.currentShapeColor}`);
            });
        }
        
        if (thicknessSelect) {
            thicknessSelect.addEventListener('change', (e) => {
                this.currentShapeThickness = parseInt(e.target.value, 10);
                this.currentBorderThickness = parseInt(e.target.value, 10); // 건물 및 교실의 테두리 굵기도 함께 변경
                console.log(`굵기 변경: ${this.currentShapeThickness}px`);
            });
        }

        const schoolSelect = document.getElementById('schoolSelect');
        if (schoolSelect) {
            schoolSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectSchool(e.target.value);
                }
            });
        }

        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveFloorPlan());
        }

        const downloadButton = document.getElementById('downloadButton');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.downloadPPT());
        }
        
        this.setupCanvasEvents();
    }
    
    setupCanvas() {
        if (!this.canvas) {
            console.error('캔버스 요소를 찾을 수 없습니다!');
            return;
        }
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    }
    
    // 도형 타입 선택 처리
    selectShape(shapeType) {
        this.currentShapeType = shapeType;
        this.currentTool = 'shape';
        this.showNotification(`${this.getShapeTypeName(shapeType)} 도형 그리기 모드입니다.`, 'info');
        
        // 도구 버튼 업데이트
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const shapeButton = document.querySelector('.tool-button[data-tool="shape"]');
        if (shapeButton) {
            shapeButton.classList.add('active');
        }
        
        // 드롭다운 메뉴 닫기
        const shapeDropdown = document.getElementById('shapeDropdown');
        if (shapeDropdown) {
            shapeDropdown.classList.remove('show');
        }
        
        // 커서 스타일 업데이트
        document.body.style.cursor = 'crosshair';
        
        // 도형 그리기 모드 클래스 추가
        document.body.classList.add('shape-drawing-mode');
        
        // 선택 해제
        this.clearSelection();
        this.multiSelectManager.clearSelection();
        
        // 도형 그리기 상태 초기화
        this.isDrawingShape = false;
        this.shapeStartPoint = null;
        this.tempShapeElement = null;
    }
    
    // 도형 타입 이름 반환
    getShapeTypeName(shapeType) {
        const shapeNames = {
            'line': '직선',
            'curve': '곡선',
            'arrow': '화살표',
            'circle': '원',
            'rect': '사각형',
            'arc': '원호',
            'dashed': '점선'
        };
        return shapeNames[shapeType] || '알 수 없는';
    }
    
    setupCanvasEvents() {
        document.addEventListener('mousemove', (e) => {
            this.dragManager.handleMouseMove(e);
            this.resizeManager.handleMouseMove(e);
            this.selectionBoxManager.updateBoxSelection(e);
            this.groupDragManager.updateGroupDrag(e);
            
            // 도형 그리기 중 업데이트
            if (this.isDrawingShape && this.shapeStartPoint && this.currentShapeType) {
                this.updateShapePreview(this.getCanvasCoordinates(e));
            }
            
            // 도형 그리기 모드에서 도형 위에 마우스를 올렸을 때 커서 변경
            if (this.currentTool === 'shape' && this.currentShapeType) {
                const isOverShape = e.target.classList.contains('shape') || e.target.closest('.shape');
                if (isOverShape) {
                    document.body.style.cursor = 'move';
                } else {
                    document.body.style.cursor = 'crosshair';
                }
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            // 드래그 관련 이벤트 처리
            const wasDragging = this.dragManager.isDragging || this.groupDragManager.isDragging;
            
            // 드래그 매니저 처리
            this.dragManager.handleMouseUp(e);
            this.resizeManager.handleMouseUp(e);
            
            // 도형 그리기 완료 처리 - 드래그 중이 아니었고 실제로 그리기 중이었을 때만 처리
            if (this.isDrawingShape && this.shapeStartPoint && !wasDragging) {
                console.log('도형 그리기 완료 처리 - 드래그 상태:', wasDragging);
                const endPoint = this.getCanvasCoordinates(e);
                
                // 시작점과 끝점의 거리가 최소 거리 이상인 경우에만 도형 생성
                const startX = this.shapeStartPoint.x;
                const startY = this.shapeStartPoint.y;
                const endX = endPoint.x;
                const endY = endPoint.y;
                
                // 거리 계산
                const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                
                if (distance >= 5) { // 최소 5픽셀 이상 이동했을 때만 도형 생성
                    this.finishShape(endPoint);
                } else {
                    // 거리가 너무 짧으면 그리기 취소
                    this.cancelShapeDrawing();
                }
            }
            
            // 박스 선택 처리
            let boxSelectionOccurred = false;
            if (this.selectionBoxManager.isBoxSelecting) {
                const selectedElements = this.selectionBoxManager.endBoxSelection(e);
                if (selectedElements.length > 0) {
                    // selectionBoxManager의 addToSelection 플래그 사용
                    const addToSelection = this.selectionBoxManager.addToSelection;
                    this.multiSelectManager.selectElements(selectedElements, addToSelection);
                    boxSelectionOccurred = true;
                }
            }
            
            // 그룹 드래그 처리
            if (this.groupDragManager.isDragging) {
                this.groupDragManager.endGroupDrag();
            }
            
            // 마우스 업 시 커서 복원
            if (this.currentTool === 'shape') {
                const isOverShape = e.target.classList.contains('shape') || e.target.closest('.shape');
                if (isOverShape) {
                    document.body.style.cursor = 'move';
                } else {
                    document.body.style.cursor = 'crosshair';
                }
            }
        });
        
        this.canvas.addEventListener('click', (e) => {
            // 박스 선택 중에는 클릭 이벤트 무시
            if (this.selectionBoxManager.hasActuallyDragged) {
                this.selectionBoxManager.hasActuallyDragged = false;
                return;
            }
            
            // 이름 박스 이동 중에는 클릭 이벤트 무시
            if (this.nameBoxManager.movingState.active || this.nameBoxManager.resizingState.active) {
                return;
            }
            
            if (e.target.id === 'canvasContent' && this.pendingClickCoords) {
                this.handleCanvasClickAtCoords(this.pendingClickCoords);
                this.pendingClickCoords = null;
            }
        });
        
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));
        
        // 터치 이벤트 처리
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
    
    selectSchool(schoolId) {
        if (!schoolId) {
            this.currentSchoolId = null;
            this.clearCanvas();
            this.unplacedRoomsManager.unplacedRooms = [];
            this.unplacedRoomsManager.renderUnplacedRooms();
            
            // 학교가 선택되지 않았을 때도 도형 배열 초기화
            this.floorPlanData.shapes = [];
            return;
        }
        
        this.currentSchoolId = schoolId;
        this.loadFloorPlanData(schoolId);
        this.unplacedRoomsManager.loadUnplacedRooms(schoolId);
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        document.querySelectorAll('.toolbar').forEach(toolbar => {
            toolbar.classList.remove('active');
        });
        document.getElementById(`${mode}Toolbar`).classList.add('active');
        
        this.updateCanvasForMode();
        
        if (window.scrollFixManager) {
            window.scrollFixManager.reregister();
        }
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        this.clearSelection();
        
        const activeToolbar = document.querySelector('.toolbar.active');
        if (activeToolbar) {
            this.updateToolButtons(activeToolbar, tool);
        }
        
        this.updateCanvasCursor();

        // 도구 선택 시 색상과 굵기 정보 업데이트
        this.updateStyleSelectors();
        
        // 도형 그리기 모드가 아닌 경우 클래스 제거
        if (tool !== 'shape') {
            document.body.classList.remove('shape-drawing-mode');
        }
    }
    
    // 색상과 굵기 선택기 업데이트 메서드 추가
    updateStyleSelectors() {
        const colorSelect = document.getElementById('shapeColorSelect');
        const thicknessSelect = document.getElementById('shapeThicknessSelect');
        
        if (colorSelect) {
            colorSelect.value = this.currentShapeColor;
        }
        
        if (thicknessSelect) {
            thicknessSelect.value = this.currentShapeThickness;
        }
    }
    
    updateToolButtons(toolbar, tool) {
        toolbar.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = toolbar.querySelector(`[data-tool="${tool}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    updateCanvasCursor() {
        const cursorStyle = {
            select: 'default',
            building: 'crosshair',
            room: 'crosshair',
            'add-ap': 'crosshair',
            delete: 'not-allowed',
            copy: 'copy',
            shape: 'crosshair'  // 도형 그리기 도구 추가
        }[this.currentTool] || 'default';
        this.canvas.style.setProperty('cursor', cursorStyle, 'important');
    }
    
    async loadFloorPlanData(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/school/${schoolId}`);
            if (response.ok) {
                this.floorPlanData = await response.json();
                this.renderFloorPlan();
                this.showNotification('평면도 데이터를 불러왔습니다.');
            } else {
                this.showNotification('평면도 데이터 로딩에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('평면도 데이터 로딩 오류:', error);
            this.showNotification('평면도 데이터 로딩 중 오류가 발생했습니다.', 'error');
        }
    }
    
    renderFloorPlan() {
        this.clearCanvas();
        
        this.renderLayoutMode(); // Base layout
        
        if(this.currentMode === 'device') {
            this.renderDeviceIcons();
        } else if (this.currentMode === 'wireless') {
            this.renderWirelessAPs();
        }

        if (this.floorPlanData.shapes) {
            this.floorPlanData.shapes.forEach(shape => this.renderShape(shape));
        }
    }
    
    renderLayoutMode() {
        if (this.floorPlanData.buildings) {
            this.floorPlanData.buildings.forEach(building => this.renderBuilding(building));
        }
        if (this.floorPlanData.rooms) {
            this.floorPlanData.rooms.forEach(room => this.renderRoom(room));
        }
        if (this.floorPlanData.shapes) {
            this.floorPlanData.shapes.forEach(shape => this.renderShape(shape));
        }
    }
    
    renderDeviceIcons() {
        document.querySelectorAll('.room').forEach(roomElement => {
            const roomId = roomElement.dataset.id;
            if (roomId && roomId !== 'new') {
                this.loadAndDisplayDeviceIcons(roomId, roomElement);
            }
        });
    }
    
    async loadAndDisplayDeviceIcons(roomId, roomElement) {
        try {
            const response = await fetch(`/floorplan/api/room/${roomId}/devices`);
            if (response.ok) {
                const deviceCounts = await response.json();
                this.displayDeviceIcons(roomElement, deviceCounts);
            }
        } catch (error) {
            console.error('장비 정보 로딩 오류:', error);
        }
    }
    
    displayDeviceIcons(roomElement, deviceCounts) {
        const existingIcons = roomElement.querySelector('.device-icons');
        if (existingIcons) existingIcons.remove();
        
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'device-icons';
        
        Object.entries(deviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                const iconElement = document.createElement('div');
                iconElement.className = 'device-icon';
                iconElement.innerHTML = `${this.getDeviceIcon(type)} ${count}`;
                iconsContainer.appendChild(iconElement);
            }
        });
        
        roomElement.appendChild(iconsContainer);
    }
    
    getDeviceIcon(deviceType) {
        const iconMap = {
            '모니터': '<i class="fas fa-desktop"></i>',
            '노트북': '<i class="fas fa-laptop"></i>',
            '태블릿': '<i class="fas fa-tablet-alt"></i>',
            '프린터': '<i class="fas fa-print"></i>',
            '스피커': '<i class="fas fa-volume-up"></i>',
            '카메라': '<i class="fas fa-camera"></i>',
            '키보드': '<i class="fas fa-keyboard"></i>',
            '마우스': '<i class="fas fa-mouse"></i>',
            'default': '<i class="fas fa-microchip"></i>'
        };
        return iconMap[deviceType] || iconMap.default;
    }
    
    renderWirelessAPs() {
        if (this.floorPlanData.apsByRoom) {
            Object.entries(this.floorPlanData.apsByRoom).forEach(([roomId, aps]) => {
                aps.forEach(ap => this.renderWirelessAP(ap, roomId));
            });
        }
    }
    
    renderWirelessAP(ap, roomId) {
        const roomElement = document.querySelector(`[data-id="${roomId}"]`);
        if (!roomElement) return;
        
        const apElement = document.createElement('div');
        apElement.className = 'wireless-ap draggable';
        apElement.dataset.type = 'wireless-ap';
        apElement.dataset.id = ap.apLocationId || 'new';
        apElement.dataset.roomId = roomId;
        apElement.innerHTML = '<i class="fas fa-wifi"></i>';
        apElement.style.left = (ap.xCoordinate || 50) + 'px';
        apElement.style.top = (ap.yCoordinate || 40) + 'px';
        apElement.style.width = ((ap.radius || 8) * 2) + 'px';
        apElement.style.height = ((ap.radius || 8) * 2) + 'px';
        apElement.style.backgroundColor = ap.color || '#ef4444';
        apElement.style.position = 'absolute';
        
        roomElement.appendChild(apElement);
        this.addElementEvents(apElement);
    }
    
    addElementEvents(element) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 선택 도구가 활성화된 경우에만 선택 처리
            if (this.currentTool === 'select') {
                // Ctrl, Meta 또는 Shift 키를 누르고 있으면 다중 선택에 추가/제거
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    if (this.multiSelectManager.isSelected(element)) {
                        this.multiSelectManager.removeFromSelection(element);
                    } else {
                        this.multiSelectManager.addToSelection(element);
                    }
                } else {
                    // 일반 클릭은 단일 선택
                    this.multiSelectManager.clearSelection();
                    this.multiSelectManager.addToSelection(element);
                    this.selectElement(element);
                }
            } else if (this.currentTool === 'delete') {
                // 삭제 도구가 활성화된 경우
                const elementId = element.dataset.id;
                const isRoom = element.classList.contains('room');
                const isBuilding = element.classList.contains('building');
                const isShape = element.classList.contains('shape');
                
                element.remove();
                
                if (isRoom) {
                    // 교실인 경우
                    const roomData = this.floorPlanData.rooms.find(room => 
                        room.floorRoomId === elementId);
                    
                    if (roomData) {
                        // 미배치 교실 목록에 추가
                        this.unplacedRoomsManager.addToUnplacedList(roomData);
                    }
                    
                    this.floorPlanData.rooms = this.floorPlanData.rooms.filter(room => 
                        room.floorRoomId !== elementId);
                    
                    this.showNotification('개체가 삭제되었습니다.');
                } else if (isBuilding) {
                    // 건물인 경우
                    this.floorPlanData.buildings = this.floorPlanData.buildings.filter(building => 
                        building.buildingId !== elementId);
                    
                    this.showNotification('개체가 삭제되었습니다.');
                } else if (isShape) {
                    // 도형인 경우
                    this.floorPlanData.shapes = this.floorPlanData.shapes.filter(shape => 
                        shape.id !== elementId);
                    
                    this.showNotification('개체가 삭제되었습니다.');
                }
            } else {
                this.editElement(element);
            }
        });
        
        element.addEventListener('mousedown', (e) => {
            if (this.currentTool === 'select') {
                e.stopPropagation();
                if (e.target.classList.contains('resize-handle')) return;
                
                // 이미 선택된 요소 그룹에 포함된 경우 그룹 드래그 시작
                if (this.multiSelectManager.hasSelection() && this.multiSelectManager.getSelectedElements().includes(element)) {
                    this.groupDragManager.startGroupDrag(this.multiSelectManager.getSelectedElements(), e);
                } else {
                    // Ctrl, Meta 또는 Shift 키가 눌려있지 않으면 기존 선택 해제
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                        this.multiSelectManager.clearSelection();
                    }
                    
                    // 현재 요소를 선택에 추가하고 드래그 시작
                    this.multiSelectManager.addToSelection(element);
                    this.dragManager.startDrag(element, e);
                }
            }
        });

        // 더블클릭 이벤트 수정 - 도형에만 이름 지정 기능을 비활성화하고 건물과 교실에는 활성화
        element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            
            // 도형이 아닌 경우(건물, 교실)에만 이름박스 이동 모드 활성화
            if (!element.classList.contains('shape')) {
                this.nameBoxManager.toggleMoveMode(element);
            }
        });
        
        // 호버 이벤트 추가 - 교실과 건물에 대해 마우스 오버 시 z-index 조정
        element.addEventListener('mouseover', (e) => {
            // 교실이나 건물인 경우에만 z-index 조정
            if (element.classList.contains('room') || element.classList.contains('building')) {
                // 교실인 경우 임시로 z-index를 높게 설정
                if (element.classList.contains('room')) {
                    element.dataset.originalZIndex = element.style.zIndex || '';
                    element.style.zIndex = '1000'; // 높은 z-index 값
                }
            }
            
            // 모든 요소에 대해 커서를 move로 설정
            element.style.cursor = 'move';
            
            // 도형 그리기 모드일 때 도형 위에 있으면 커서 스타일 변경
            if (this.currentTool === 'shape') {
                document.body.style.cursor = 'move';
            }
        });
        
        // 마우스 아웃 시 원래 z-index로 복원
        element.addEventListener('mouseout', (e) => {
            if (element.classList.contains('room') && !this.dragManager.isDragging) {
                if (element.dataset.originalZIndex) {
                    element.style.zIndex = element.dataset.originalZIndex;
                } else {
                    element.style.zIndex = '';
                }
            }
            
            // 도형 그리기 모드일 때 도형에서 마우스가 벗어나면 커서 스타일 복원
            if (this.currentTool === 'shape') {
                document.body.style.cursor = 'crosshair';
            }
        });
        
        this.resizeManager.addResizeHandles(element);
    }
    
    handleCanvasMouseDown(e) {
        const isNameBoxAction = e.target.closest('.name-box.movable');
        
        if (this.nameBoxManager.movableState.object && !isNameBoxAction) {
            this.nameBoxManager.disableMoveMode();
        }

        if (this.nameBoxManager.movingState.active || this.nameBoxManager.resizingState.active) {
            return;
        }

        // 도형 위에서 마우스 다운 이벤트가 발생한 경우 도형 그리기 시작하지 않음
        const isOverShape = e.target.classList.contains('shape') || e.target.closest('.shape');
        
        // 캔버스 영역 내에서만 처리
        if (this.canvas.contains(e.target)) {
            if (this.currentTool === 'select') {
                // Ctrl, Meta 또는 Shift 키가 눌려있지 않고 이름 박스 액션이 아닌 경우에만 선택 해제
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !isNameBoxAction) {
                    this.multiSelectManager.clearSelection();
                    this.clearSelection();
                }
                
                // Shift 키 상태를 전달하여 박스 선택 시작
                this.selectionBoxManager.startBoxSelection(e, e.shiftKey || e.ctrlKey || e.metaKey);
            } 
            else if (this.currentTool === 'shape' && this.currentShapeType) {
                // 도형 그리기 도구가 활성화된 경우, 도형 위가 아닐 때만 그리기 시작
                if (!isOverShape) {
                    this.startDrawingShape(this.getCanvasCoordinates(e));
                } else {
                    // 도형 위에서는 드래그 시작
                    const shapeElement = e.target.closest('.shape');
                    if (shapeElement) {
                        // 도형 그리기 모드 중 도형을 드래그할 때는 그리기 상태 초기화
                        this.resetShapeDrawing();
                        this.dragManager.startDrag(shapeElement, e);
                    }
                }
            }
            
            this.pendingClickCoords = this.getCanvasCoordinates(e);
        }
    }
    
    handleCanvasClickAtCoords(coords) {
        const { x, y } = coords;
        switch (this.currentTool) {
            case 'building':
                const buildingName = prompt('건물 이름을 입력하세요:', '새 건물');
                if (buildingName !== null) {
                    this.createBuilding(x, y, buildingName);
                    this.selectTool('select');
                }
                break;
            case 'room':
                const roomName = prompt('교실 이름을 입력하세요:', '새 교실');
                if (roomName !== null) {
                    this.createRoom(x, y, roomName);
                    this.selectTool('select');
                }
                break;
            case 'add-ap':
                if (this.currentMode === 'wireless') this.createWirelessAP(x, y);
                break;
            case 'select':
            default:
                this.clearSelection();
                break;
        }
    }
    
    handleRightClick(e) {
        e.preventDefault();
    }
    
    createBuilding(x, y, name) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        const buildingData = {
            buildingName: name,
            xCoordinate: x - 100,
            yCoordinate: y - 150,
            width: 200,
            height: 300,
            schoolId: this.currentSchoolId,
            borderColor: this.currentBorderColor,
            borderThickness: this.currentBorderThickness
        };
        this.floorPlanData.buildings.push(buildingData);
        this.renderBuilding(buildingData);
        this.showNotification(`건물 '${name}'이(가) 생성되었습니다.`);
    }
    
    createRoom(x, y, name) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // 임시 ID 생성
        const tempId = 'temp_' + Date.now();
        
        const roomData = {
            roomName: name,
            roomType: 'classroom',
            xCoordinate: x - 50,
            yCoordinate: y - 40,
            width: 100,
            height: 80,
            classroomId: tempId,
            schoolId: this.currentSchoolId,
            borderColor: this.currentBorderColor,
            borderThickness: this.currentBorderThickness
        };
        
        if (!this.floorPlanData.rooms) this.floorPlanData.rooms = [];
        this.floorPlanData.rooms.push(roomData);
        this.renderRoom(roomData);
        this.showNotification(`교실 '${name}'이(가) 생성되었습니다.`);
    }

    renderElement(type, data) {
        const element = document.createElement('div');
        element.className = `draggable ${type}`;
        element.dataset.type = type;
        element.dataset.id = data.buildingId || data.floorRoomId || this._getTempId();
        
        const name = data.buildingName || data.roomName || `새 ${type}`;
        element.dataset.name = name;

        // 테두리 색상과 굵기 정보를 명확하게 저장
        if (type === 'building' || type === 'room') {
            // 데이터에서 테두리 정보 가져오기, 없으면 현재 설정된 값 사용
            const borderColor = data.borderColor || this.currentBorderColor;
            const borderThickness = data.borderThickness || this.currentBorderThickness;
            
            // dataset에 테두리 정보 저장 (위치 이동 후에도 유지하기 위함)
            element.dataset.borderColor = borderColor;
            element.dataset.borderThickness = borderThickness;
            
            console.log(`요소 생성: ${type}, 테두리 색상: ${borderColor}, 굵기: ${borderThickness}px`);
        }

        element.style.position = 'absolute';
        element.style.left = (data.xCoordinate || 50) + 'px';
        element.style.top = (data.yCoordinate || 50) + 'px';
        element.style.width = (data.width || 200) + 'px';
        element.style.height = (data.height || 300) + 'px';
        
        // 테두리 색상과 굵기 적용 - !important 추가하여 우선순위 높임
        if (type === 'building' || type === 'room') {
            const borderColor = data.borderColor || this.currentBorderColor;
            const borderThickness = data.borderThickness || this.currentBorderThickness;
            
            element.style.cssText += `
                border-color: ${borderColor} !important;
                border-width: ${borderThickness}px !important;
                border-style: solid !important;
                box-sizing: border-box !important;
            `;
        }

        this.canvas.appendChild(element);
        this.addElementEvents(element);
        this.nameBoxManager.createOrUpdateNameBox(element);
        
        return element;
    }
    
    renderBuilding(building) {
        this.renderElement('building', building);
    }
    
    renderRoom(room) {
        this.renderElement('room', room);
    }
    
    selectElement(element) {
        this.clearSelection();
        this.selectedElement = element;
        element.classList.add('selected');
        
        // 선택 시에도 테두리 스타일 유지
        if (element.classList.contains('building') || element.classList.contains('room')) {
            this.restoreBorderStyle(element);
        }
    }
    
    clearSelection() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.snapManager.hideSnapFeedback(this.selectedElement);
            
            // 선택 해제 시에도 테두리 스타일 복원
            if (this.selectedElement.classList.contains('building') || this.selectedElement.classList.contains('room')) {
                this.restoreBorderStyle(this.selectedElement);
            }
            
            this.selectedElement = null;
        }
        this.multiSelectManager.clearSelection();
    }
    
    editElement(element) {
        const type = element.dataset.type;
        
        // 도형인 경우 이름 지정 기능을 비활성화
        if (type === 'shape' || element.classList.contains('shape')) {
            return; // 도형에 대한 이름 지정 기능 비활성화
        }
        
        const name = prompt(`${type}의 새 이름을 입력하세요:`, element.dataset.name);
        if (name && name.trim()) {
            element.dataset.name = name.trim();
            this.nameBoxManager.createOrUpdateNameBox(element);
            this.showNotification('이름이 변경되었습니다.');
        }
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) this.handleCanvasMouseDown(e.touches[0]);
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            this.dragManager.handleMouseMove(touch);
            this.resizeManager.handleMouseMove(touch);
        }
    }
    
    handleTouchEnd(e) {
        this.dragManager.handleMouseUp(e);
        this.resizeManager.handleMouseUp(e);
    }
    
    async saveFloorPlan() {
        if (!this.currentSchoolId) {
            this.showNotification('학교를 먼저 선택해주세요.', 'error');
            return;
        }
        const saveData = this.collectFloorPlanData();
        try {
            const response = await fetch('/floorplan/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });
            this.showNotification(response.ok ? '평면도가 저장되었습니다.' : '저장에 실패했습니다.', response.ok ? 'success' : 'error');
        } catch (error) {
            console.error('저장 오류:', error);
            this.showNotification('저장 중 오류가 발생했습니다.', 'error');
        }
    }
    
    collectFloorPlanData() {
        const collectElements = (type) => {
            return Array.from(document.querySelectorAll(`.${type}`)).map(el => ({
                [`${type}Id`]: el.dataset.id !== 'new' ? el.dataset.id : null,
                [`${type}Name`]: el.dataset.name,
                xCoordinate: parseInt(el.style.left),
                yCoordinate: parseInt(el.style.top),
                width: parseInt(el.style.width),
                height: parseInt(el.style.height),
                borderColor: el.style.borderColor || '#000000',
                borderThickness: parseInt(el.style.borderWidth) || 2,
                schoolId: this.currentSchoolId
            }));
        };
        
        // 도형 요소 수집
        const collectShapes = () => {
            return Array.from(document.querySelectorAll('.shape')).map(el => {
                // 기본 데이터
                const shapeData = {
                    id: el.dataset.id,
                    type: el.dataset.shapetype,
                    xCoordinate: parseInt(el.style.left),
                    yCoordinate: parseInt(el.style.top),
                    width: parseInt(el.style.width),
                    height: parseInt(el.style.height) || 0,
                    transform: el.style.transform,
                    color: el.style.backgroundColor || el.style.borderColor,
                    thickness: parseInt(el.style.height) || parseInt(el.style.borderWidth) || 2,
                    schoolId: this.currentSchoolId
                };
                
                // 도형 유형별로 추가 데이터
                if (el.dataset.shapetype === 'curve') {
                    shapeData.svgContent = el.innerHTML;
                }
                
                return shapeData;
            });
        };
        
        return {
            schoolId: this.currentSchoolId,
            buildings: collectElements('building'),
            rooms: collectElements('room'),
            shapes: collectShapes()
        };
    }
    
    async downloadPPT() {
        if (!this.currentSchoolId) {
            this.showNotification('학교를 먼저 선택해주세요.', 'error');
            return;
        }
        try {
            this.showNotification('PPT 파일을 생성 중입니다...', 'success');
            const response = await fetch(`/floorplan/api/download-ppt/${this.currentSchoolId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'school_floorplan.pptx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                this.showNotification('PPT 파일이 다운로드되었습니다.');
            } else {
                this.showNotification('PPT 생성에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('PPT 다운로드 오류:', error);
            this.showNotification('PPT 다운로드 중 오류가 발생했습니다.', 'error');
        }
    }
    
    updateCanvasForMode() {
        this.renderFloorPlan();
    }
    
    clearCanvas() {
        if(this.canvas) this.canvas.innerHTML = '';
    }
    
    // 화면에 알림 메시지를 표시하는 메서드
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (!notification || !notificationText) return;
        
        notificationText.textContent = message;
        notification.className = 'notification show ' + type;
        
        setTimeout(() => {
            notification.className = 'notification';
        }, 3000);
    }
    
    createWirelessAP(x, y) {
        if (!this.currentSchoolId) return;
        
        const roomElement = document.elementFromPoint(x, y)?.closest('.room');
        if (!roomElement) {
            this.showNotification('교실 위에 무선AP를 추가해주세요.', 'error');
            return;
        }
        
        const apData = {
            xCoordinate: x - roomElement.offsetLeft,
            yCoordinate: y - roomElement.offsetTop,
            radius: 8,
            color: '#ef4444'
        };
        
        this.renderWirelessAP(apData, roomElement.dataset.id);
    }

    handleToolClick(tool) {
        this.selectTool(tool);
        
        // 삭제 도구가 선택되었을 때 안내 메시지 표시
        if (tool === 'delete') {
            this.showNotification('삭제 모드: 삭제하려는 요소를 클릭하세요.', 'info');
        } else if (tool === 'building') {
            this.showNotification('건물 추가 모드: 캔버스에 클릭하여 건물을 추가하세요.', 'info');
        } else if (tool === 'room') {
            this.showNotification('교실 추가 모드: 캔버스에 클릭하여 교실을 추가하세요.', 'info');
        }
    }

    getCanvasCoordinates(e) {
        if (this.zoomManager && this.zoomManager.initialized) {
            return this.zoomManager.getCanvasCoordinates(e);
        } else {
            const rect = this.canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    }

    _getTempId() {
        this.tempIdCounter += 1;
        return `temp-id-${this.tempIdCounter}`;
    }

    // 도형 그리기 시작
    startDrawingShape(startPoint) {
        this.isDrawingShape = true;
        this.shapeStartPoint = startPoint;
        
        // 색상 및 굵기 설정
        const borderColor = this.currentShapeColor;
        const borderWidth = parseInt(this.currentShapeThickness);
        
        // 임시 도형 요소 생성
        this.tempShapeElement = document.createElement('div');
        this.tempShapeElement.className = `shape shape-${this.currentShapeType}`;
        this.tempShapeElement.style.position = 'absolute';
        
        // 도형 유형에 따라 초기 스타일 설정
        switch (this.currentShapeType) {
            case 'line':
            case 'arrow':
            case 'dashed':
                // 선 타입 도형의 초기 설정 - 시작점에 정확히 위치하도록 수정
                this.tempShapeElement.style.left = startPoint.x + 'px';
                this.tempShapeElement.style.top = startPoint.y + 'px';
                this.tempShapeElement.style.width = '1px';
                this.tempShapeElement.style.height = borderWidth + 'px';
                this.tempShapeElement.style.backgroundColor = borderColor;
                this.tempShapeElement.style.transformOrigin = '0 50%'; // 왼쪽 중앙을 기준점으로 설정
                break;
            case 'circle':
            case 'rect':
            case 'arc':
                this.tempShapeElement.style.left = startPoint.x + 'px';
                this.tempShapeElement.style.top = startPoint.y + 'px';
                this.tempShapeElement.style.width = '1px';
                this.tempShapeElement.style.height = '1px';
                this.tempShapeElement.style.borderColor = borderColor;
                this.tempShapeElement.style.borderWidth = borderWidth + 'px';
                this.tempShapeElement.style.borderStyle = 'solid';
                break;
            case 'curve':
                // 곡선은 베지어 곡선으로 구현
                this.tempShapeElement.style.left = startPoint.x + 'px';
                this.tempShapeElement.style.top = startPoint.y + 'px';
                
                // SVG 방식으로 베지어 곡선 구현 (초기)
                const path = `
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,0 Q0,0 0,0" 
                              stroke="${borderColor}" fill="transparent" stroke-width="${borderWidth}"/>
                    </svg>
                `;
                this.tempShapeElement.innerHTML = path;
                break;
        }
        
        this.canvas.appendChild(this.tempShapeElement);
    }
    
    // 도형 그리기 중 미리보기 업데이트 함수 수정
    updateShapePreview(currentPoint) {
        if (!this.tempShapeElement || !this.shapeStartPoint) return;
        
        const startX = this.shapeStartPoint.x;
        const startY = this.shapeStartPoint.y;
        const endX = currentPoint.x;
        const endY = currentPoint.y;
        
        // 색상 및 굵기 가져오기
        const borderColor = this.currentShapeColor;
        const borderWidth = parseInt(this.currentShapeThickness);
        
        switch (this.currentShapeType) {
            case 'line':
            case 'arrow':
            case 'dashed':
                // 각도 계산
                const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
                
                // 선 위치 및 크기 설정 - 시작점에서 정확히 그려지도록 수정
                this.tempShapeElement.style.width = length + 'px';
                this.tempShapeElement.style.left = startX + 'px';
                this.tempShapeElement.style.top = startY + 'px';
                this.tempShapeElement.style.transformOrigin = '0 50%'; // 왼쪽 중앙을 기준점으로 설정
                this.tempShapeElement.style.transform = `rotate(${angle}deg)`;
                
                if (this.currentShapeType === 'dashed') {
                    // 점선 패턴 설정 - 작은 굵기에서도 보이도록 고정 크기 사용
                    const dashSize = 5;
                    const gapSize = 5;
                    this.tempShapeElement.style.background = `repeating-linear-gradient(to right, ${borderColor}, ${borderColor} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`;
                }
                break;
            case 'circle':
            case 'rect':
            case 'arc':
                // 시작점을 기준으로 크기 조절
                const width = Math.abs(endX - startX);
                const height = Math.abs(endY - startY);
                
                // 시작점이 항상 왼쪽 위 모서리가 되게 조정
                const left = Math.min(startX, endX);
                const top = Math.min(startY, endY);
                
                this.tempShapeElement.style.left = left + 'px';
                this.tempShapeElement.style.top = top + 'px';
                this.tempShapeElement.style.width = width + 'px';
                this.tempShapeElement.style.height = height + 'px';
                this.tempShapeElement.style.borderColor = borderColor;
                this.tempShapeElement.style.borderWidth = borderWidth + 'px';
                break;
            case 'curve':
                // 임시 방법: 곡선을 베지어 곡선의 형태로 시뮬레이션
                const midX = (startX + endX) / 2;
                const midY = Math.min(startY, endY) - Math.abs(endX - startX) / 4;
                
                this.tempShapeElement.style.width = Math.abs(endX - startX) + 'px';
                this.tempShapeElement.style.height = Math.abs(Math.max(startY, endY) - midY) + 'px';
                
                // SVG 방식으로 베지어 곡선 구현 (심플하게)
                const path = `
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,${startY - midY} Q${(endX - startX) / 2},${-Math.abs(endX - startX) / 4} ${endX - startX},${endY - midY}" 
                              stroke="${borderColor}" fill="transparent" stroke-width="${borderWidth}"/>
                    </svg>
                `;
                this.tempShapeElement.innerHTML = path;
                break;
        }
    }
    
    // 도형 그리기 완료
    finishShape(endPoint) {
        if (!this.isDrawingShape || !this.shapeStartPoint || !this.tempShapeElement) return;
        
        const startX = this.shapeStartPoint.x;
        const startY = this.shapeStartPoint.y;
        const endX = endPoint.x;
        const endY = endPoint.y;
        
        // 너무 작은 도형은 생성하지 않음 (최소 크기 조정)
        const minSize = 3;
        if (Math.abs(endX - startX) < minSize && Math.abs(endY - startY) < minSize) {
            if (this.tempShapeElement.parentNode) {
                this.tempShapeElement.parentNode.removeChild(this.tempShapeElement);
            }
            this.resetShapeDrawing();
            return;
        }
        
        console.log('도형 생성 완료:', {
            type: this.currentShapeType,
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            schoolId: this.currentSchoolId || 'no_school'
        });
        
        // 임시 요소 제거
        if (this.tempShapeElement.parentNode) {
            this.tempShapeElement.parentNode.removeChild(this.tempShapeElement);
        }
        
        // 최종 도형 생성
        const shapeElement = this.createShape(this.currentShapeType, startX, startY, endX, endY);
        
        // 도형 그리기 상태 초기화
        this.resetShapeDrawing();
        
        // 도구를 선택 모드로 되돌림
        this.selectTool('select');
    }
    
    // 도형 그리기 취소 함수 추가
    cancelShapeDrawing() {
        if (this.tempShapeElement && this.tempShapeElement.parentNode) {
            this.tempShapeElement.parentNode.removeChild(this.tempShapeElement);
        }
        this.resetShapeDrawing();
    }
    
    // 도형 그리기 상태 초기화
    resetShapeDrawing() {
        this.isDrawingShape = false;
        this.shapeStartPoint = null;
        this.tempShapeElement = null;
    }
    
    // 최종 도형 생성
    createShape(shapeType, startX, startY, endX, endY) {
        const shapeId = 'shape_' + Date.now();
        
        // 도형 데이터 생성
        const shapeData = {
            id: shapeId,
            type: shapeType,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            color: this.currentShapeColor,
            thickness: parseInt(this.currentShapeThickness),
            schoolId: this.currentSchoolId || 'no_school' // 학교가 선택되지 않았을 경우 기본값 설정
        };
        
        // 도형 요소 생성
        const shapeElement = document.createElement('div');
        shapeElement.className = `draggable shape shape-${shapeType}`;
        shapeElement.dataset.id = shapeId;
        shapeElement.dataset.type = 'shape';
        
        // 도형 유형별 스타일 설정
        const thickness = parseInt(this.currentShapeThickness);
        const color = this.currentShapeColor;
        
        switch (shapeType) {
            case 'line':
            case 'arrow':
            case 'dashed':
                // 선 길이 및 각도 계산
                const dx = endX - startX;
                const dy = endY - startY;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                
                // 선 스타일 설정
                shapeElement.style.left = startX + 'px';
                shapeElement.style.top = startY + 'px';
                shapeElement.style.width = length + 'px';
                shapeElement.style.height = thickness + 'px';
                shapeElement.style.backgroundColor = color;
                shapeElement.style.transformOrigin = '0 50%'; // 왼쪽 중앙을 기준점으로 설정
                shapeElement.style.transform = `rotate(${angle}deg)`;
                
                if (shapeType === 'dashed') {
                    // 점선 패턴 설정
                    const dashSize = 5;
                    const gapSize = 5;
                    shapeElement.style.background = `repeating-linear-gradient(to right, ${color}, ${color} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`;
                } else if (shapeType === 'arrow') {
                    // 화살표 스타일 설정
                    const arrowSize = Math.max(thickness * 3, 8);
                    const arrowHead = document.createElement('div');
                    arrowHead.className = 'arrow-head';
                    arrowHead.style.position = 'absolute';
                    arrowHead.style.right = '0';
                    arrowHead.style.top = '50%';
                    arrowHead.style.transform = 'translate(0, -50%)';
                    arrowHead.style.width = '0';
                    arrowHead.style.height = '0';
                    arrowHead.style.borderTop = `${arrowSize/2}px solid transparent`;
                    arrowHead.style.borderBottom = `${arrowSize/2}px solid transparent`;
                    arrowHead.style.borderLeft = `${arrowSize}px solid ${color}`;
                    arrowHead.style.marginRight = `-${arrowSize}px`;
                    shapeElement.appendChild(arrowHead);
                }
                break;
            case 'rect':
                // 사각형 위치 및 크기 계산
                const left = Math.min(startX, endX);
                const top = Math.min(startY, endY);
                const width = Math.abs(endX - startX);
                const height = Math.abs(endY - startY);
                
                // 사각형 스타일 설정
                shapeElement.style.left = left + 'px';
                shapeElement.style.top = top + 'px';
                shapeElement.style.width = width + 'px';
                shapeElement.style.height = height + 'px';
                shapeElement.style.borderWidth = thickness + 'px';
                shapeElement.style.borderStyle = 'solid';
                shapeElement.style.borderColor = color;
                shapeElement.style.backgroundColor = 'transparent';
                break;
            case 'circle':
                // 원 위치 및 크기 계산
                const circleLeft = Math.min(startX, endX);
                const circleTop = Math.min(startY, endY);
                const circleWidth = Math.abs(endX - startX);
                const circleHeight = Math.abs(endY - startY);
                
                // 원 스타일 설정
                shapeElement.style.left = circleLeft + 'px';
                shapeElement.style.top = circleTop + 'px';
                shapeElement.style.width = circleWidth + 'px';
                shapeElement.style.height = circleHeight + 'px';
                shapeElement.style.borderWidth = thickness + 'px';
                shapeElement.style.borderStyle = 'solid';
                shapeElement.style.borderColor = color;
                shapeElement.style.backgroundColor = 'transparent';
                shapeElement.style.borderRadius = '50%';
                break;
            case 'arc':
                // 호 위치 및 크기 계산
                const arcLeft = Math.min(startX, endX);
                const arcTop = Math.min(startY, endY);
                const arcWidth = Math.abs(endX - startX);
                const arcHeight = Math.abs(endY - startY);
                
                // 호 스타일 설정
                shapeElement.style.left = arcLeft + 'px';
                shapeElement.style.top = arcTop + 'px';
                shapeElement.style.width = arcWidth + 'px';
                shapeElement.style.height = arcHeight + 'px';
                shapeElement.style.borderWidth = thickness + 'px';
                shapeElement.style.borderStyle = 'solid';
                shapeElement.style.borderColor = color;
                shapeElement.style.backgroundColor = 'transparent';
                shapeElement.style.borderRadius = '50%';
                shapeElement.style.borderBottomColor = 'transparent';
                shapeElement.style.borderLeftColor = 'transparent';
                shapeElement.style.transform = 'rotate(45deg)';
                break;
            case 'curve':
                // 곡선 위치 및 크기 계산
                const curveLeft = Math.min(startX, endX);
                const curveTop = Math.min(startY, endY);
                const curveWidth = Math.abs(endX - startX);
                const curveHeight = Math.abs(endY - startY);
                
                // 곡선 중간 제어점 계산
                const controlX = curveWidth / 2;
                const controlY = -curveHeight / 2;
                
                // 곡선 스타일 설정
                shapeElement.style.left = curveLeft + 'px';
                shapeElement.style.top = curveTop + 'px';
                shapeElement.style.width = curveWidth + 'px';
                shapeElement.style.height = curveHeight + 'px';
                
                // SVG 방식으로 베지어 곡선 구현
                const path = `
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,${curveHeight} Q${controlX},${controlY} ${curveWidth},${curveHeight}" 
                              stroke="${color}" fill="transparent" stroke-width="${thickness}"/>
                    </svg>
                `;
                shapeElement.innerHTML = path;
                break;
        }
        
        // 도형 요소에 이벤트 리스너 추가
        this.addElementEvents(shapeElement);
        
        // 캔버스에 도형 추가
        this.canvas.appendChild(shapeElement);
        
        // 도형 데이터 저장
        if (!this.floorPlanData.shapes) {
            this.floorPlanData.shapes = [];
        }
        this.floorPlanData.shapes.push(shapeData);
        
        return shapeElement;
    }

    // 저장된 도형 데이터를 렌더링 함수 수정
    renderShape(shapeData) {
        const shapeElement = document.createElement('div');
        shapeElement.className = `draggable shape shape-${shapeData.type}`;
        shapeElement.dataset.id = shapeData.id;
        shapeElement.dataset.type = 'shape';
        shapeElement.dataset.shapetype = shapeData.type;
        
        // 색상 및 굵기 설정
        const borderColor = shapeData.color || '#000000';
        const borderWidth = parseInt(shapeData.thickness || 2);
        
        // 위치와 크기 설정
        shapeElement.style.position = 'absolute';
        
        // 도형 유형별 특수 처리
        if (shapeData.type === 'line' || shapeData.type === 'arrow' || shapeData.type === 'dashed') {
            // 선 타입 도형 렌더링
            const startX = shapeData.xCoordinate || shapeData.startX || 0;
            const startY = shapeData.yCoordinate || shapeData.startY || 0;
            const endX = shapeData.endX || (startX + (shapeData.width || 0));
            const endY = shapeData.endY || startY;
            
            // 길이와 각도 계산
            const dx = endX - startX;
            const dy = endY - startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // 선 스타일 설정
            shapeElement.style.left = startX + 'px';
            shapeElement.style.top = startY + 'px';
            shapeElement.style.width = length + 'px';
            shapeElement.style.height = borderWidth + 'px';
            shapeElement.style.backgroundColor = borderColor;
            shapeElement.style.transformOrigin = '0 50%'; // 왼쪽 중앙을 기준점으로 설정
            shapeElement.style.transform = `rotate(${angle}deg)`;
            
            if (shapeData.type === 'dashed') {
                // 점선 패턴 설정
                const dashSize = 5;
                const gapSize = 5;
                shapeElement.style.background = `repeating-linear-gradient(to right, ${borderColor}, ${borderColor} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`;
            } else if (shapeData.type === 'arrow') {
                // 화살표 스타일 설정
                const arrowSize = Math.max(borderWidth * 3, 8);
                const arrowHead = document.createElement('div');
                arrowHead.className = 'arrow-head';
                arrowHead.style.position = 'absolute';
                arrowHead.style.right = '0';
                arrowHead.style.top = '50%';
                arrowHead.style.transform = 'translate(0, -50%)';
                arrowHead.style.width = '0';
                arrowHead.style.height = '0';
                arrowHead.style.borderTop = `${arrowSize/2}px solid transparent`;
                arrowHead.style.borderBottom = `${arrowSize/2}px solid transparent`;
                arrowHead.style.borderLeft = `${arrowSize}px solid ${borderColor}`;
                arrowHead.style.marginRight = `-${arrowSize}px`;
                shapeElement.appendChild(arrowHead);
            }
        } else if (shapeData.type === 'rect') {
            // 사각형 렌더링
            const left = shapeData.xCoordinate || Math.min(shapeData.startX || 0, shapeData.endX || 0);
            const top = shapeData.yCoordinate || Math.min(shapeData.startY || 0, shapeData.endY || 0);
            const width = shapeData.width || Math.abs((shapeData.endX || 0) - (shapeData.startX || 0));
            const height = shapeData.height || Math.abs((shapeData.endY || 0) - (shapeData.startY || 0));
            
            shapeElement.style.left = left + 'px';
            shapeElement.style.top = top + 'px';
            shapeElement.style.width = width + 'px';
            shapeElement.style.height = height + 'px';
            shapeElement.style.borderWidth = borderWidth + 'px';
            shapeElement.style.borderStyle = 'solid';
            shapeElement.style.borderColor = borderColor;
            shapeElement.style.backgroundColor = 'transparent';
        } else if (shapeData.type === 'circle') {
            // 원 렌더링
            const left = shapeData.xCoordinate || Math.min(shapeData.startX || 0, shapeData.endX || 0);
            const top = shapeData.yCoordinate || Math.min(shapeData.startY || 0, shapeData.endY || 0);
            const width = shapeData.width || Math.abs((shapeData.endX || 0) - (shapeData.startX || 0));
            const height = shapeData.height || Math.abs((shapeData.endY || 0) - (shapeData.startY || 0));
            
            shapeElement.style.left = left + 'px';
            shapeElement.style.top = top + 'px';
            shapeElement.style.width = width + 'px';
            shapeElement.style.height = height + 'px';
            shapeElement.style.borderWidth = borderWidth + 'px';
            shapeElement.style.borderStyle = 'solid';
            shapeElement.style.borderColor = borderColor;
            shapeElement.style.backgroundColor = 'transparent';
            shapeElement.style.borderRadius = '50%';
        } else if (shapeData.type === 'arc') {
            // 호 렌더링
            const left = shapeData.xCoordinate || Math.min(shapeData.startX || 0, shapeData.endX || 0);
            const top = shapeData.yCoordinate || Math.min(shapeData.startY || 0, shapeData.endY || 0);
            const width = shapeData.width || Math.abs((shapeData.endX || 0) - (shapeData.startX || 0));
            const height = shapeData.height || Math.abs((shapeData.endY || 0) - (shapeData.startY || 0));
            
            shapeElement.style.left = left + 'px';
            shapeElement.style.top = top + 'px';
            shapeElement.style.width = width + 'px';
            shapeElement.style.height = height + 'px';
            shapeElement.style.borderWidth = borderWidth + 'px';
            shapeElement.style.borderStyle = 'solid';
            shapeElement.style.borderColor = borderColor;
            shapeElement.style.backgroundColor = 'transparent';
            shapeElement.style.borderRadius = '50%';
            shapeElement.style.borderBottomColor = 'transparent';
            shapeElement.style.borderLeftColor = 'transparent';
            shapeElement.style.transform = 'rotate(45deg)';
        } else if (shapeData.type === 'curve') {
            // 곡선 렌더링
            const left = shapeData.xCoordinate || Math.min(shapeData.startX || 0, shapeData.endX || 0);
            const top = shapeData.yCoordinate || Math.min(shapeData.startY || 0, shapeData.endY || 0);
            const width = shapeData.width || Math.abs((shapeData.endX || 0) - (shapeData.startX || 0));
            const height = shapeData.height || Math.abs((shapeData.endY || 0) - (shapeData.startY || 0));
            
            // 곡선 중간 제어점 계산
            const controlX = width / 2;
            const controlY = -height / 2;
            
            shapeElement.style.left = left + 'px';
            shapeElement.style.top = top + 'px';
            shapeElement.style.width = width + 'px';
            shapeElement.style.height = height + 'px';
            
            // SVG 방식으로 베지어 곡선 구현
            const path = `
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0,${height} Q${controlX},${controlY} ${width},${height}" 
                          stroke="${borderColor}" fill="transparent" stroke-width="${borderWidth}"/>
                </svg>
            `;
            shapeElement.innerHTML = path;
        }
        
        // 도형 요소에 이벤트 리스너 추가
        this.addElementEvents(shapeElement);
        
        // 캔버스에 도형 추가
        this.canvas.appendChild(shapeElement);
        
        return shapeElement;
    }

    // 마우스 이벤트가 캔버스 내부에 있는지 확인하는 함수 추가
    isMouseEventInsideCanvas(e) {
        if (!this.canvas) return false;
        
        const rect = this.canvas.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    }

    // DragManager에 이벤트 리스너 추가
    setupDragEventListeners() {
        const originalHandleMouseUp = this.dragManager.handleMouseUp;
        
        this.dragManager.handleMouseUp = (e) => {
            originalHandleMouseUp.call(this.dragManager, e);
            
            // 드래그 완료 후 교실 목록 업데이트
            this.handleElementMoved();
        };
        
        // GroupDragManager에도 적용
        const originalEndGroupDrag = this.groupDragManager.endGroupDrag;
        
        this.groupDragManager.endGroupDrag = () => {
            originalEndGroupDrag.call(this.groupDragManager);
            
            // 그룹 드래그 완료 후 교실 목록 업데이트
            this.handleElementMoved();
        };
    }

    // DragManager 클래스의 handleMouseUp 이후에 테두리 스타일을 복원하는 메서드
    restoreBorderStyle(element) {
        if (!element) return;
        
        if (element.classList.contains('building') || element.classList.contains('room')) {
            // dataset에서 테두리 정보 가져오기
            const borderColor = element.dataset.borderColor || '#000000';
            const borderThickness = element.dataset.borderThickness || 2;
            
            // !important를 사용하여 테두리 스타일 강제 적용
            element.style.cssText += `
                border-color: ${borderColor} !important;
                border-width: ${borderThickness}px !important;
                border-style: solid !important;
                box-sizing: border-box !important;
            `;
            
            console.log(`테두리 스타일 복원: ${borderColor}, ${borderThickness}px`);
        }
    }

    // 건물 내부 교실 요소 쉽게 선택하기 위한 메서드 추가
    createRoomSelector() {
        // 건물 내부 교실 선택 도구 UI 생성
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'room-selector-container';
        selectorContainer.style.position = 'absolute';
        selectorContainer.style.top = '10px';
        selectorContainer.style.right = '10px';
        selectorContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        selectorContainer.style.padding = '10px';
        selectorContainer.style.borderRadius = '5px';
        selectorContainer.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        selectorContainer.style.zIndex = '2000';
        selectorContainer.style.maxHeight = '300px';
        selectorContainer.style.overflowY = 'auto';
        selectorContainer.style.display = 'none';
        
        // 헤더 추가
        const header = document.createElement('div');
        header.textContent = '교실 선택';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '10px';
        header.style.borderBottom = '1px solid #ddd';
        header.style.paddingBottom = '5px';
        selectorContainer.appendChild(header);
        
        // 교실 목록 컨테이너
        const roomListContainer = document.createElement('div');
        roomListContainer.className = 'room-list';
        selectorContainer.appendChild(roomListContainer);
        
        // 토글 버튼 생성
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '교실 목록';
        toggleButton.className = 'btn btn-sm btn-primary room-selector-toggle';
        toggleButton.style.position = 'absolute';
        toggleButton.style.top = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.zIndex = '1999';
        
        // 토글 버튼 클릭 이벤트
        toggleButton.addEventListener('click', () => {
            if (selectorContainer.style.display === 'none') {
                selectorContainer.style.display = 'block';
                this.updateRoomSelectorList();
            } else {
                selectorContainer.style.display = 'none';
            }
        });
        
        // 캔버스 컨테이너에 추가
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.appendChild(toggleButton);
            canvasContainer.appendChild(selectorContainer);
        }
        
        this.roomSelectorContainer = selectorContainer;
        this.roomListContainer = roomListContainer;
    }
    
    // 교실 목록 업데이트
    updateRoomSelectorList() {
        if (!this.roomListContainer) return;
        
        // 목록 초기화
        this.roomListContainer.innerHTML = '';
        
        // 건물 내부 교실 필터링
        const buildingRooms = [];
        
        // 모든 건물 요소 가져오기
        const buildingElements = document.querySelectorAll('.building');
        
        buildingElements.forEach(building => {
            const buildingId = building.dataset.id;
            const buildingName = building.dataset.name || '건물';
            
            // 건물 내부 교실 요소 찾기
            const buildingRect = building.getBoundingClientRect();
            const roomElements = document.querySelectorAll('.room');
            
            const roomsInBuilding = [];
            
            roomElements.forEach(room => {
                const roomRect = room.getBoundingClientRect();
                
                // 교실이 건물 내부에 있는지 확인
                if (this.isRoomInsideBuilding(room, building)) {
                    roomsInBuilding.push({
                        element: room,
                        name: room.dataset.name || '교실'
                    });
                }
            });
            
            if (roomsInBuilding.length > 0) {
                buildingRooms.push({
                    buildingId,
                    buildingName,
                    rooms: roomsInBuilding
                });
            }
        });
        
        // 건물별 교실 목록 생성
        buildingRooms.forEach(building => {
            // 건물 헤더
            const buildingHeader = document.createElement('div');
            buildingHeader.textContent = building.buildingName;
            buildingHeader.style.fontWeight = 'bold';
            buildingHeader.style.marginTop = '10px';
            buildingHeader.style.marginBottom = '5px';
            this.roomListContainer.appendChild(buildingHeader);
            
            // 교실 목록
            building.rooms.forEach(room => {
                const roomItem = document.createElement('div');
                roomItem.textContent = room.name;
                roomItem.style.padding = '3px 5px';
                roomItem.style.cursor = 'pointer';
                roomItem.style.borderRadius = '3px';
                roomItem.style.marginBottom = '2px';
                
                // 호버 효과
                roomItem.addEventListener('mouseover', () => {
                    roomItem.style.backgroundColor = '#f0f0f0';
                });
                
                roomItem.addEventListener('mouseout', () => {
                    roomItem.style.backgroundColor = '';
                });
                
                // 클릭 시 해당 교실 선택
                roomItem.addEventListener('click', () => {
                    // 다른 모든 요소 선택 해제
                    this.multiSelectManager.clearSelection();
                    
                    // 해당 교실 선택
                    this.selectElement(room.element);
                    this.multiSelectManager.addToSelection(room.element);
                    
                    // 교실로 스크롤
                    room.element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    
                    // 교실 강조 효과
                    room.element.style.zIndex = '1000';
                    room.element.classList.add('highlight-room');
                    
                    // 1초 후 강조 효과 제거
                    setTimeout(() => {
                        room.element.classList.remove('highlight-room');
                    }, 2000);
                });
                
                this.roomListContainer.appendChild(roomItem);
            });
        });
        
        // 교실이 없을 경우 메시지 표시
        if (buildingRooms.length === 0) {
            const noRoomsMsg = document.createElement('div');
            noRoomsMsg.textContent = '건물 내부에 교실이 없습니다.';
            noRoomsMsg.style.color = '#888';
            noRoomsMsg.style.padding = '10px 0';
            this.roomListContainer.appendChild(noRoomsMsg);
        }
    }
    
    // 교실이 건물 내부에 있는지 확인하는 메서드
    isRoomInsideBuilding(roomElement, buildingElement) {
        // 요소의 위치 및 크기 정보 가져오기
        const roomRect = {
            x: parseFloat(roomElement.style.left) || 0,
            y: parseFloat(roomElement.style.top) || 0,
            width: parseFloat(roomElement.style.width) || 0,
            height: parseFloat(roomElement.style.height) || 0
        };
        
        const buildingRect = {
            x: parseFloat(buildingElement.style.left) || 0,
            y: parseFloat(buildingElement.style.top) || 0,
            width: parseFloat(buildingElement.style.width) || 0,
            height: parseFloat(buildingElement.style.height) || 0
        };
        
        // 교실의 중심점이 건물 내부에 있는지 확인
        const roomCenterX = roomRect.x + roomRect.width / 2;
        const roomCenterY = roomRect.y + roomRect.height / 2;
        
        return (
            roomCenterX >= buildingRect.x &&
            roomCenterX <= buildingRect.x + buildingRect.width &&
            roomCenterY >= buildingRect.y &&
            roomCenterY <= buildingRect.y + buildingRect.height
        );
    }

    // 요소가 추가될 때 교실 목록 업데이트
    addElement(elementData) {
        // 기존 로직 유지...
        
        // 교실 선택기 업데이트
        if (this.roomSelectorContainer && this.roomSelectorContainer.style.display !== 'none') {
            this.updateRoomSelectorList();
        }
    }
    
    // 요소가 삭제될 때 교실 목록 업데이트
    removeElement(element) {
        // 기존 로직 유지...
        
        // 교실 선택기 업데이트
        if (this.roomSelectorContainer && this.roomSelectorContainer.style.display !== 'none') {
            this.updateRoomSelectorList();
        }
    }
    
    // 드래그 완료 후 교실 목록 업데이트
    handleElementMoved() {
        // 교실 선택기 업데이트
        if (this.roomSelectorContainer && this.roomSelectorContainer.style.display !== 'none') {
            this.updateRoomSelectorList();
        }
    }
} 