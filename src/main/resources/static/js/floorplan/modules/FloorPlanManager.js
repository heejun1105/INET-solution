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
        this.floorPlanData = {
            buildings: [],
            rooms: [],
            seats: [],
            deviceLocations: [],
            wirelessApLocations: []
        };
        this.tempIdCounter = 0;
        
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

        const schoolSelect = document.getElementById('schoolSelect');
        if (schoolSelect) {
            schoolSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectSchool(e.target.value);
                }
            });
        }

        const saveButton = document.getElementById('saveFloorPlan');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveFloorPlan());
        }

        const downloadButton = document.getElementById('downloadPPT');
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
    
    setupCanvasEvents() {
        document.addEventListener('mousemove', (e) => {
            this.dragManager.handleMouseMove(e);
            this.resizeManager.handleMouseMove(e);
            this.selectionBoxManager.updateBoxSelection(e);
            this.groupDragManager.updateGroupDrag(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.dragManager.handleMouseUp(e);
            this.resizeManager.handleMouseUp(e);
            
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
            
            if (!boxSelectionOccurred && !this.dragManager.isDragging && 
                !this.groupDragManager.isDragging && this.pendingClickCoords && 
                e.target.id === 'canvasContent') {
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
    }
    
    renderLayoutMode() {
        if (this.floorPlanData.buildings) {
            this.floorPlanData.buildings.forEach(building => this.renderBuilding(building));
        }
        if (this.floorPlanData.rooms) {
            this.floorPlanData.rooms.forEach(room => this.renderRoom(room));
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
                this.showNotification('요소가 삭제되었습니다.');
                this.nameBoxManager.removeNameBox(element.dataset.id);
                element.remove();
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

        element.addEventListener('dblclick', (e) => {
            this.nameBoxManager.toggleMoveMode(element);
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
            this.pendingClickCoords = this.getCanvasCoordinates(e);
        }
    }
    
    handleCanvasClickAtCoords(coords) {
        const { x, y } = coords;
        switch (this.currentTool) {
            case 'building':
                this.createBuilding(x, y);
                this.selectTool('select');
                break;
            case 'room':
                this.createRoom(x, y);
                this.selectTool('select');
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
    
    createBuilding(x, y) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        const buildingData = {
            buildingName: '새 건물',
            xCoordinate: x - 100,
            yCoordinate: y - 150,
            width: 200,
            height: 300,
            schoolId: this.currentSchoolId
        };
        this.floorPlanData.buildings.push(buildingData);
        this.renderBuilding(buildingData);
    }
    
    createRoom(x, y) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        const roomData = {
            roomName: '새 교실',
            roomType: 'classroom',
            xCoordinate: x - 50,
            yCoordinate: y - 40,
            width: 100,
            height: 80,
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
        return {
            schoolId: this.currentSchoolId,
            buildings: collectElements('building'),
            rooms: collectElements('room')
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
    
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        
        text.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
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
} 