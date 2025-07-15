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
        this.groupDragManager = new GroupDragManager(this);
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
            });
        }
        
        if (thicknessSelect) {
            thicknessSelect.addEventListener('change', (e) => {
                this.currentShapeThickness = parseInt(e.target.value, 10);
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
        });
        
        document.addEventListener('mouseup', (e) => {
            this.dragManager.handleMouseUp(e);
            this.resizeManager.handleMouseUp(e);
            
            // 도형 그리기 완료 처리 - 캔버스 내부에서만 도형 생성 완료 처리
            if (this.isDrawingShape && this.shapeStartPoint && this.isMouseEventInsideCanvas(e)) {
                const endPoint = this.getCanvasCoordinates(e);
                this.finishShape(endPoint);
            } else if (this.isDrawingShape) {
                // 캔버스 외부에서 마우스를 떼면 도형 그리기 취소
                this.cancelShapeDrawing();
            }
            
            let boxSelectionOccurred = false;
            if (this.selectionBoxManager.isBoxSelecting) {
                const selectedElements = this.selectionBoxManager.endBoxSelection(e);
                if (selectedElements.length > 0) {
                    const addToSelection = e.ctrlKey || e.metaKey;
                    this.multiSelectManager.selectElements(selectedElements, addToSelection);
                    boxSelectionOccurred = true;
                }
            }
            
            if (this.groupDragManager.isDragging) {
                this.groupDragManager.endGroupDrag();
            }
            
            // 캔버스 내부 클릭 시에만 handleCanvasClickAtCoords 호출하도록 수정
            if (!boxSelectionOccurred && !this.dragManager.isDragging && 
                !this.groupDragManager.isDragging && this.pendingClickCoords && 
                e.target.id === 'canvasContent' && this.isMouseEventInsideCanvas(e)) {
                this.handleCanvasClickAtCoords(this.pendingClickCoords);
            }
            
            this.pendingClickCoords = null;
        });
        
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleCanvasMouseDown(e);
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.multiSelectManager.clearSelection();
                this.clearSelection();
                this.selectionBoxManager.cancelBoxSelection();
                this.groupDragManager.cancelGroupDrag();
            }
        });
    }
    
    selectSchool(schoolId) {
        if (!schoolId) {
            this.currentSchoolId = null;
            this.clearCanvas();
            this.unplacedRoomsManager.unplacedRooms = [];
            this.unplacedRoomsManager.renderUnplacedRooms();
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
            copy: 'copy'
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
            if (this.currentTool === 'select') {
                if (e.ctrlKey || e.metaKey) {
                    this.multiSelectManager.toggleElement(element);
                } else {
                    this.multiSelectManager.clearSelection();
                    this.selectElement(element);
                }
            } else if (this.currentTool === 'delete') {
                // 요소가 교실인지 확인
                const isRoom = element.classList.contains('room');
                const isShape = element.classList.contains('shape');
                const isBuilding = element.classList.contains('building');
                
                // 데이터에서 요소 찾기
                const elementId = element.dataset.id;
                const elementName = element.dataset.name || '';
                const elementType = isRoom ? '교실' : isBuilding ? '건물' : '개체';
                
                // nameBox 관련 오류 수정: nameBox 요소를 직접 찾아서 제거
                const nameBox = element.querySelector('.name-box');
                if (nameBox) {
                    nameBox.remove();
                }
                
                // 요소 삭제
                element.remove();
                
                // 삭제된 요소를 데이터에서도 제거
                if (isRoom) {
                    this.floorPlanData.rooms = this.floorPlanData.rooms.filter(room => 
                        room.floorRoomId !== elementId && room.classroomId !== elementId);
                    
                    // 새교실인지 확인 (ID가 'new'거나 'temp_'로 시작하거나 이름에 '새 교실'이 포함된 경우)
                    const isNewRoom = elementId === 'new' || 
                                     (elementId && elementId.toString().startsWith('temp_')) ||
                                     (elementName && elementName.includes('새 교실'));
                    
                    if (!isNewRoom) {
                        // 미배치교실에서 가져온 교실인 경우에만 처리
                        const elementData = {
                            classroomId: elementId,
                            roomName: elementName,
                            schoolId: this.currentSchoolId
                        };
                        
                        this.unplacedRoomsManager.addToUnplacedList(elementData);
                        this.showNotification(`교실 '${elementName}'이(가) 삭제되고 미배치 교실로 이동되었습니다.`);
                    } else {
                        // 새교실인 경우는 단순 삭제
                        this.showNotification('개체가 삭제되었습니다.');
                    }
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
                
                if (this.multiSelectManager.hasSelection() && this.multiSelectManager.getSelectedElements().includes(element)) {
                    this.groupDragManager.startGroupDrag(this.multiSelectManager.getSelectedElements(), e);
                } else {
                    if (!e.ctrlKey && !e.metaKey) {
                        this.multiSelectManager.clearSelection();
                    }
                    this.dragManager.startDrag(element, e);
                }
            }
        });

        // 도형 더블클릭 이벤트 수정 - 모든 도형에 대해 이름 입력 기능 제거
        element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
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

        if (e.target.id === 'canvasContent') {
            if (this.currentTool === 'select') {
                if (!e.ctrlKey && !e.metaKey && !isNameBoxAction) {
                    this.multiSelectManager.clearSelection();
                    this.clearSelection();
                }
                this.selectionBoxManager.startBoxSelection(e);
            } 
            else if (this.currentTool === 'shape' && this.currentShapeType) {
                // 도형 그리기 시작
                this.startDrawingShape(this.getCanvasCoordinates(e));
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
            schoolId: this.currentSchoolId
        };
        this.floorPlanData.buildings.push(buildingData);
        this.renderBuilding(buildingData);
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
            schoolId: this.currentSchoolId
        };
        
        if (!this.floorPlanData.rooms) this.floorPlanData.rooms = [];
        this.floorPlanData.rooms.push(roomData);
        this.renderRoom(roomData);
    }

    renderElement(type, data) {
        const element = document.createElement('div');
        element.className = `draggable ${type}`;
        element.dataset.type = type;
        element.dataset.id = data.buildingId || data.floorRoomId || this._getTempId();
        
        const name = data.buildingName || data.roomName || `새 ${type}`;
        element.dataset.name = name;

        element.style.position = 'absolute';
        element.style.left = (data.xCoordinate || 50) + 'px';
        element.style.top = (data.yCoordinate || 50) + 'px';
        element.style.width = (data.width || 200) + 'px';
        element.style.height = (data.height || 300) + 'px';

        this.canvas.appendChild(element);
        this.addElementEvents(element);
        this.nameBoxManager.createOrUpdateNameBox(element);
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
    }
    
    clearSelection() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.snapManager.hideSnapFeedback(this.selectedElement);
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
                // 선 타입 도형의 초기 설정
                this.tempShapeElement.style.left = startPoint.x + 'px';
                this.tempShapeElement.style.top = (startPoint.y - borderWidth / 2) + 'px'; // 중앙 정렬
                this.tempShapeElement.style.width = '1px';
                this.tempShapeElement.style.height = borderWidth + 'px';
                this.tempShapeElement.style.backgroundColor = borderColor;
                this.tempShapeElement.style.border = 'none'; // 테두리 제거
                this.tempShapeElement.style.outline = 'none'; // 외곽선 제거
                
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
                
                // 선 위치 및 크기 설정
                this.tempShapeElement.style.width = length + 'px';
                this.tempShapeElement.style.transform = `rotate(${angle}deg)`;
                this.tempShapeElement.style.top = (startY - borderWidth / 2) + 'px'; // 중앙 정렬
                this.tempShapeElement.style.height = borderWidth + 'px';
                this.tempShapeElement.style.backgroundColor = borderColor;
                
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
        
        // 너무 작은 도형은 생성하지 않음
        const minSize = 5;
        if (Math.abs(endX - startX) < minSize && Math.abs(endY - startY) < minSize) {
            if (this.tempShapeElement.parentNode) {
                this.tempShapeElement.parentNode.removeChild(this.tempShapeElement);
            }
            this.resetShapeDrawing();
            return;
        }
        
        // 임시 요소 제거
        if (this.tempShapeElement.parentNode) {
            this.tempShapeElement.parentNode.removeChild(this.tempShapeElement);
        }
        
        // 최종 도형 생성
        this.createShape(this.currentShapeType, startX, startY, endX, endY);
        
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
            thickness: parseInt(this.currentShapeThickness)
        };
        
        // 도형 요소 생성
        const shapeElement = document.createElement('div');
        shapeElement.className = `draggable shape shape-${shapeType}`;
        shapeElement.dataset.id = shapeId;
        shapeElement.dataset.type = 'shape';
        shapeElement.dataset.shapetype = shapeType;
        
        // 색상 및 굵기 적용
        const borderColor = this.currentShapeColor;
        const borderWidth = parseInt(this.currentShapeThickness);
        
        // 도형 유형에 따라 스타일 설정
        switch (shapeType) {
            case 'line':
            case 'arrow':
            case 'dashed':
                // 각도 계산
                const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
                
                // 선 위치 및 크기 설정
                shapeElement.style.left = startX + 'px';
                shapeElement.style.top = (startY - borderWidth / 2) + 'px'; // 중앙 정렬
                shapeElement.style.width = length + 'px';
                shapeElement.style.height = borderWidth + 'px';
                shapeElement.style.backgroundColor = borderColor;
                shapeElement.style.transform = `rotate(${angle}deg)`;
                shapeElement.style.border = 'none'; // 테두리 제거
                shapeElement.style.outline = 'none'; // 외곽선 제거
                
                // 추가 데이터 저장 (나중에 렌더링할 때 사용)
                shapeData.width = length;
                shapeData.transform = `rotate(${angle}deg)`;
                shapeData.xCoordinate = startX;
                shapeData.yCoordinate = startY - borderWidth / 2;
                
                if (shapeType === 'arrow') {
                    // 화살표 끝 부분 스타일 정의
                    const arrowAfter = document.createElement('style');
                    const arrowSize = Math.max(borderWidth * 2, 6); // 화살표 크기는 선 굵기의 2배 (최소 6px)
                    arrowAfter.innerHTML = `
                        .shape-arrow[data-id="${shapeId}"]::after {
                            content: '';
                            position: absolute;
                            right: -1px;
                            top: ${-(arrowSize/2 - borderWidth/2)}px;
                            width: 0;
                            height: 0;
                            border-left: ${arrowSize}px solid ${borderColor};
                            border-top: ${arrowSize/2}px solid transparent;
                            border-bottom: ${arrowSize/2}px solid transparent;
                        }
                    `;
                    document.head.appendChild(arrowAfter);
                }
                
                if (shapeType === 'dashed') {
                    // 점선 패턴 설정 - 작은 굵기에서도 보이도록 고정 크기 사용
                    const dashSize = 5;
                    const gapSize = 5;
                    shapeElement.style.background = `repeating-linear-gradient(to right, ${borderColor}, ${borderColor} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`;
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
                
                shapeElement.style.left = left + 'px';
                shapeElement.style.top = top + 'px';
                shapeElement.style.width = width + 'px';
                shapeElement.style.height = height + 'px';
                shapeElement.style.borderColor = borderColor;
                shapeElement.style.borderWidth = borderWidth + 'px';
                shapeElement.style.borderStyle = 'solid';
                
                // 추가 데이터 저장
                shapeData.width = width;
                shapeData.height = height;
                shapeData.xCoordinate = left;
                shapeData.yCoordinate = top;
                break;
            case 'curve':
                // 베지어 곡선 구현
                const midX = (startX + endX) / 2;
                const midY = Math.min(startY, endY) - Math.abs(endX - startX) / 4;
                
                const curveLeft = Math.min(startX, endX);
                const curveWidth = Math.abs(endX - startX);
                const curveHeight = Math.abs(Math.max(startY, endY) - midY);
                
                shapeElement.style.left = curveLeft + 'px';
                shapeElement.style.top = midY + 'px';
                shapeElement.style.width = curveWidth + 'px';
                shapeElement.style.height = curveHeight + 'px';
                
                // SVG 방식으로 베지어 곡선 구현
                const path = `
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,${startY - midY} Q${curveWidth / 2},${-Math.abs(endX - startX) / 4} ${curveWidth},${endY - midY}" 
                              stroke="${borderColor}" fill="transparent" stroke-width="${borderWidth}"/>
                    </svg>
                `;
                shapeElement.innerHTML = path;
                
                // 추가 데이터 저장
                shapeData.width = curveWidth;
                shapeData.height = curveHeight;
                shapeData.xCoordinate = curveLeft;
                shapeData.yCoordinate = midY;
                shapeData.svgContent = path;
                break;
        }
        
        // 도형에 이벤트 추가
        this.addElementEvents(shapeElement);
        
        // 캔버스에 추가
        this.canvas.appendChild(shapeElement);
        
        // 도형 데이터 저장
        this.floorPlanData.shapes.push(shapeData);
        
        this.showNotification(`${this.getShapeTypeName(shapeType)} 도형이 추가되었습니다.`);
        
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
            shapeElement.style.left = (shapeData.xCoordinate || shapeData.startX || 0) + 'px';
            shapeElement.style.top = (shapeData.yCoordinate || (shapeData.startY - borderWidth / 2) || 0) + 'px';
            shapeElement.style.width = (shapeData.width || 0) + 'px';
            shapeElement.style.height = borderWidth + 'px';
            shapeElement.style.backgroundColor = borderColor;
            shapeElement.style.border = 'none'; // 테두리 제거
            shapeElement.style.outline = 'none'; // 외곽선 제거
            
            // 회전 변환 적용
            if (shapeData.transform) {
                shapeElement.style.transform = shapeData.transform;
            } else if (shapeData.startX !== undefined && shapeData.startY !== undefined && 
                      shapeData.endX !== undefined && shapeData.endY !== undefined) {
                // 시작점과 끝점으로 각도 계산
                const angle = Math.atan2(shapeData.endY - shapeData.startY, shapeData.endX - shapeData.startX) * 180 / Math.PI;
                shapeElement.style.transform = `rotate(${angle}deg)`;
            }
            
            if (shapeData.type === 'arrow') {
                // 화살표 끝 부분 스타일 정의
                const arrowAfter = document.createElement('style');
                const arrowSize = Math.max(borderWidth * 2, 6); // 화살표 크기는 선 굵기의 2배 (최소 6px)
                arrowAfter.innerHTML = `
                    .shape-arrow[data-id="${shapeData.id}"]::after {
                        content: '';
                        position: absolute;
                        right: -1px;
                        top: ${-(arrowSize/2 - borderWidth/2)}px;
                        width: 0;
                        height: 0;
                        border-left: ${arrowSize}px solid ${borderColor};
                        border-top: ${arrowSize/2}px solid transparent;
                        border-bottom: ${arrowSize/2}px solid transparent;
                    }
                `;
                document.head.appendChild(arrowAfter);
            }
            
            if (shapeData.type === 'dashed') {
                // 점선 패턴 설정 - 작은 굵기에서도 보이도록 고정 크기 사용
                const dashSize = 5;
                const gapSize = 5;
                shapeElement.style.background = `repeating-linear-gradient(to right, ${borderColor}, ${borderColor} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`;
            }
        } else if (shapeData.type === 'curve') {
            // 곡선 도형 렌더링
            shapeElement.style.left = (shapeData.xCoordinate || 0) + 'px';
            shapeElement.style.top = (shapeData.yCoordinate || 0) + 'px';
            shapeElement.style.width = (shapeData.width || 0) + 'px';
            shapeElement.style.height = (shapeData.height || 0) + 'px';
            
            if (shapeData.svgContent) {
                // 저장된 SVG 콘텐츠가 있으면 사용
                shapeElement.innerHTML = shapeData.svgContent;
            } else {
                // 없으면 시작점과 끝점으로 새로 생성
                const startX = shapeData.startX || 0;
                const startY = shapeData.startY || 0;
                const endX = shapeData.endX || 0;
                const endY = shapeData.endY || 0;
                const midY = shapeElement.style.top.replace('px', '');
                
                const path = `
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,${startY - midY} Q${(endX - startX) / 2},${-Math.abs(endX - startX) / 4} ${endX - startX},${endY - midY}" 
                              stroke="${borderColor}" fill="transparent" stroke-width="${borderWidth}"/>
                    </svg>
                `;
                shapeElement.innerHTML = path;
            }
        } else {
            // 원, 사각형, 호 등 다른 도형 렌더링
            shapeElement.style.left = (shapeData.xCoordinate || shapeData.startX || 0) + 'px';
            shapeElement.style.top = (shapeData.yCoordinate || shapeData.startY || 0) + 'px';
            shapeElement.style.width = (shapeData.width || 0) + 'px';
            shapeElement.style.height = (shapeData.height || 0) + 'px';
            shapeElement.style.borderColor = borderColor;
            shapeElement.style.borderWidth = borderWidth + 'px';
            shapeElement.style.borderStyle = 'solid';
        }
        
        // 도형에 이벤트 추가
        this.addElementEvents(shapeElement);
        
        // 캔버스에 추가
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
} 