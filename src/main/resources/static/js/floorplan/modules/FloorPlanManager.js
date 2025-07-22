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
        this.currentOtherSpaceType = null; // 현재 선택된 기타공간 타입
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
            // 줌 설정 후 캔버스 중앙 뷰 설정
            setTimeout(() => {
                this.zoomManager.centerCanvasView();
            }, 100);
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
        
        // 기타공간 드롭다운 토글 처리
        const otherSpaceButton = document.getElementById('otherSpaceButton');
        const otherSpaceDropdown = document.getElementById('otherSpaceDropdown');
        
        if (otherSpaceButton && otherSpaceDropdown) {
            otherSpaceButton.addEventListener('click', (e) => {
                e.stopPropagation();
                otherSpaceDropdown.classList.toggle('show');
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#otherSpaceButton') && !e.target.closest('#otherSpaceDropdown')) {
                    otherSpaceDropdown.classList.remove('show');
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
        
        // 기타공간 드롭다운 항목 클릭 이벤트
        document.querySelectorAll('[data-other-space]').forEach(item => {
            item.addEventListener('click', (e) => {
                const otherSpaceType = e.currentTarget.dataset.otherSpace;
                this.selectOtherSpace(otherSpaceType);
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
    
    // 기타공간 타입 선택 처리
    selectOtherSpace(otherSpaceType) {
        this.currentOtherSpaceType = otherSpaceType;
        this.currentTool = 'other-space';
        this.showNotification(`${otherSpaceType} 추가 모드입니다. 캔버스에 클릭하여 ${otherSpaceType}을 추가하세요.`, 'info');
        
        // 도구 버튼 업데이트
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const otherSpaceButton = document.querySelector('.tool-button[data-tool="other-space"]');
        if (otherSpaceButton) {
            otherSpaceButton.classList.add('active');
        }
        
        // 드롭다운 메뉴 닫기
        const otherSpaceDropdown = document.getElementById('otherSpaceDropdown');
        if (otherSpaceDropdown) {
            otherSpaceDropdown.classList.remove('show');
        }
        
        // 커서 스타일 업데이트
        document.body.style.cursor = 'crosshair';
        
        // 선택 해제
        this.clearSelection();
        this.multiSelectManager.clearSelection();
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
            
            // 개체 생성 도구가 활성화된 경우 캔버스 내의 어디서든 클릭 처리
            const isCreationTool = this.currentTool === 'building' || this.currentTool === 'room' || 
                                 this.currentTool === 'other-space' || this.currentTool === 'add-ap';
            
            if (this.pendingClickCoords && (e.target.id === 'canvasContent' || isCreationTool)) {
                this.handleCanvasClickAtCoords(this.pendingClickCoords);
                this.pendingClickCoords = null;
            }
        });
        
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        
        // 키보드 이벤트 (전역)
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));
        
        // 터치 이벤트 처리
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }
    
    async selectSchool(schoolId) {
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
        
        // 저장된 평면도가 있는지 확인
        const hasSavedFloorPlan = await this.checkFloorPlanExists();
        
        if (hasSavedFloorPlan) {
            // 저장된 평면도가 있으면 로드
            await this.loadFloorPlan();
        } else {
            // 저장된 평면도가 없으면 기본 데이터 로드
        this.loadFloorPlanData(schoolId);
        }
        
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
        
        // 캔버스에 현재 도구 설정
        if (this.canvas) {
            this.canvas.setAttribute('data-tool', tool);
        }
        
        this.updateCanvasCursor();

        // 도구 선택 시 색상과 굵기 정보 업데이트
        this.updateStyleSelectors();
        
        // 도형 그리기 모드가 아닌 경우 클래스 제거
        if (tool !== 'shape') {
            document.body.classList.remove('shape-drawing-mode');
        }
        
        // 개체 생성 도구 활성화 시 기존 개체들의 pointer-events 조정
        this.updateElementPointerEvents();
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
        switch (this.currentTool) {
            case 'building':
            case 'room':
            case 'other-space':
            case 'add-ap':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'delete':
                this.canvas.style.cursor = 'not-allowed';
                break;
            case 'shape':
                this.canvas.style.cursor = 'crosshair';
                break;
            default:
                this.canvas.style.cursor = 'default';
                break;
        }
    }
    
    updateElementPointerEvents() {
        const isCreationTool = this.currentTool === 'building' || this.currentTool === 'room' || 
                             this.currentTool === 'other-space' || this.currentTool === 'add-ap';
        
        // 캔버스 내의 모든 draggable 요소들에 대해 pointer-events 조정
        const elements = this.canvas.querySelectorAll('.draggable');
        elements.forEach(element => {
            if (isCreationTool) {
                // 개체 생성 도구일 때는 pointer-events를 none으로 설정하여 클릭 이벤트 무시
                element.style.pointerEvents = 'none';
            } else {
                // 그 외의 경우는 pointer-events를 auto로 복원
                element.style.pointerEvents = 'auto';
            }
        });
    }
    
    async loadFloorPlanData(schoolId) {
        try {
            // 새로운 API 엔드포인트 사용
            const response = await fetch(`/floorplan/load?schoolId=${schoolId}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 저장된 평면도 데이터가 있으면 사용
                    this.floorPlanData = {
                        buildings: result.buildings || [],
                        rooms: result.rooms || [],
                        shapes: result.shapes || [],
                        otherSpaces: result.otherSpaces || [],
                        wirelessApLocations: result.wirelessAps || []
                    };
                this.renderFloorPlan();
                    this.showNotification('저장된 평면도를 불러왔습니다.');
                } else {
                    // 저장된 평면도가 없으면 기본 데이터 로드
                    this.loadDefaultFloorPlanData(schoolId);
                }
            } else {
                this.showNotification('평면도 데이터 로딩에 실패했습니다.', 'error');
                this.loadDefaultFloorPlanData(schoolId);
            }
        } catch (error) {
            console.error('평면도 데이터 로딩 오류:', error);
            this.showNotification('평면도 데이터 로딩 중 오류가 발생했습니다.', 'error');
            this.loadDefaultFloorPlanData(schoolId);
        }
    }
    
    // 기본 평면도 데이터 로드
    async loadDefaultFloorPlanData(schoolId) {
        try {
            // 기존 API에서 기본 데이터 가져오기
            const response = await fetch(`/floorplan/api/school/${schoolId}`);
            if (response.ok) {
                this.floorPlanData = await response.json();
                this.renderFloorPlan();
                this.showNotification('기본 평면도 데이터를 불러왔습니다.');
            } else {
                // API 실패 시 빈 데이터로 초기화
                this.floorPlanData = {
                    buildings: [],
                    rooms: [],
                    shapes: [],
                    otherSpaces: [],
                    wirelessApLocations: []
                };
                this.renderFloorPlan();
            }
        } catch (error) {
            console.error('기본 평면도 데이터 로딩 오류:', error);
            // 오류 시 빈 데이터로 초기화
            this.floorPlanData = {
                buildings: [],
                rooms: [],
                shapes: [],
                otherSpaces: [],
                wirelessApLocations: []
            };
            this.renderFloorPlan();
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
        // 건물 렌더링
        if (this.floorPlanData.buildings) {
            this.floorPlanData.buildings.forEach(building => this.renderBuilding(building));
        }
        
        // 교실 렌더링
        if (this.floorPlanData.rooms) {
            this.floorPlanData.rooms.forEach(room => this.renderRoom(room));
        }
        
        // 도형 렌더링
        if (this.floorPlanData.shapes) {
            this.floorPlanData.shapes.forEach(shape => this.renderShape(shape));
        }
        
        // 기타공간 렌더링
        if (this.floorPlanData.otherSpaces) {
            this.floorPlanData.otherSpaces.forEach(space => this.renderOtherSpace(space));
        }
        
        // 무선AP 렌더링
        if (this.floorPlanData.wirelessApLocations) {
            this.floorPlanData.wirelessApLocations.forEach(ap => this.renderWirelessAP(ap));
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
    
    // 교실의 장비 정보를 로드하고 아이콘을 표시
    async loadAndDisplayDeviceIcons(classroomId, roomElement) {
        try {
            console.log('🔧 장비 정보 API 호출 시작:', classroomId);
            const response = await fetch(`/floorplan/api/classroom/${classroomId}/devices`);
            
            console.log('📡 API 응답 상태:', response.status);
            
            if (response.ok) {
                const deviceCounts = await response.json();
                console.log('📊 장비 데이터 수신:', deviceCounts);
                
                if (Object.keys(deviceCounts).length === 0) {
                    console.log('📭 해당 교실에 장비가 없습니다.');
                } else {
                    console.log('✅ 장비 아이콘 표시 시작');
                    this.displayDeviceIcons(deviceCounts, roomElement);
                }
            } else {
                console.error('❌ API 응답 오류:', response.status, response.statusText);
                // 에러 시에도 빈 데이터로 처리
                this.displayDeviceIcons({}, roomElement);
            }
        } catch (error) {
            console.error('❌ 장비 정보 로딩 실패:', error);
            // 에러 시에도 빈 데이터로 처리
            this.displayDeviceIcons({}, roomElement);
        }
    }
    
    // 장비 아이콘을 교실 요소에 표시
    displayDeviceIcons(deviceCounts, roomElement) {
        // 기존 장비 아이콘 제거
        const existingDevices = roomElement.querySelector('.room-devices');
        if (existingDevices) {
            existingDevices.remove();
        }
        
        if (!deviceCounts || Object.keys(deviceCounts).length === 0) {
            this.adjustNameBoxPosition(roomElement, 0);
            return;
        }
        
        // 교실 크기 가져오기
        const roomWidth = parseInt(roomElement.style.width) || 100;
        const roomHeight = parseInt(roomElement.style.height) || 105;
        
        // 단계별 공간 체크
        const nameBox = this.nameBoxManager.getNameBoxForElement(roomElement);
        const nameBoxHeight = nameBox ? 32 : 0;
        const availableHeight = roomHeight - nameBoxHeight - 12;
        
        // 1단계: 매우 작은 크기 (2줄도 불가능) - +N만 표시
        if (roomWidth < 60 || roomHeight < 40 || availableHeight < 15) {
            console.log('교실이 매우 작아서 +N 오버플로우만 표시합니다:', roomWidth, 'x', roomHeight);
            
            const devicesContainer = document.createElement('div');
            devicesContainer.className = 'room-devices';
            devicesContainer.style.position = 'absolute';
            devicesContainer.style.bottom = '4px';
            devicesContainer.style.left = '4px';
            devicesContainer.style.right = '4px';
            devicesContainer.style.overflow = 'hidden';
            devicesContainer.style.display = 'flex';
            devicesContainer.style.flexWrap = 'wrap';
            devicesContainer.style.gap = '2px';
            devicesContainer.style.alignItems = 'center';
            devicesContainer.style.height = '20px';
            
            // 모든 장비 데이터 수집
            const allDeviceData = [];
        Object.entries(deviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                    const normalizedType = this.normalizeDeviceType(type);
                    const iconInfo = this.getDeviceIcon(normalizedType);
                    allDeviceData.push({ type: normalizedType, count, iconInfo });
                }
            });
            
            // +N 오버플로우 인디케이터만 표시
            const totalDevices = allDeviceData.reduce((sum, { count }) => sum + count, 0);
            const overflowElement = this.createOverflowIndicator(totalDevices, allDeviceData);
            devicesContainer.appendChild(overflowElement);
            
            // 교실에 추가
            roomElement.appendChild(devicesContainer);
            
            // 이름박스 위치 조정
            this.adjustNameBoxPosition(roomElement, 20 + 8);
            return;
        }
        
        // 2단계: 매우 작은 크기 (1줄도 어려움) - 1줄로 표시하고 나머지는 +N
        if (roomWidth < 50 || roomHeight < 35 || availableHeight < 12) {
            console.log('교실이 매우 작아서 1줄 + 오버플로우로 표시합니다:', roomWidth, 'x', roomHeight);
            
            const devicesContainer = document.createElement('div');
            devicesContainer.className = 'room-devices';
            devicesContainer.style.position = 'absolute';
            devicesContainer.style.bottom = '4px';
            devicesContainer.style.left = '4px';
            devicesContainer.style.right = '4px';
            devicesContainer.style.overflow = 'hidden';
            devicesContainer.style.display = 'flex';
            devicesContainer.style.flexWrap = 'wrap';
            devicesContainer.style.gap = '2px';
            devicesContainer.style.alignItems = 'center';
            devicesContainer.style.height = '20px';
            
            // 장비 타입별 개수 집계 (정규화 적용)
            const normalizedDeviceCounts = {};
            Object.entries(deviceCounts).forEach(([type, count]) => {
                if (count > 0) {
                    const normalizedType = this.normalizeDeviceType(type);
                    normalizedDeviceCounts[normalizedType] = (normalizedDeviceCounts[normalizedType] || 0) + count;
            }
        });
        
            // 장비 아이콘 생성
            const allDeviceData = [];
            const deviceElements = [];
            Object.entries(normalizedDeviceCounts).forEach(([type, count]) => {
                if (count > 0) {
                    const iconInfo = this.getDeviceIcon(type);
                    allDeviceData.push({ type, count, iconInfo });
                    
                    const deviceIcon = document.createElement('div');
                    deviceIcon.className = `device-icon ${iconInfo.class}`;
                    deviceIcon.innerHTML = `
                        <i class="${iconInfo.icon}"></i>
                        <span class="device-count">${count}</span>
                    `;
                    deviceIcon.title = `${type}: ${count}개`;
                    deviceIcon.style.flexShrink = '0';
                    deviceIcon.style.fontSize = '10px';
                    deviceIcon.style.lineHeight = '1';
                    deviceIcon.style.whiteSpace = 'nowrap';
                    deviceIcon.style.maxWidth = '100%';
                    deviceIcon.style.overflow = 'hidden';
                    deviceElements.push(deviceIcon);
                }
            });
            
            // 1줄에 들어갈 수 있는 아이콘 수 계산
            const availableWidth = roomWidth - 8;
            let visibleCount = 0;
            let currentWidth = 0;
            const iconWidth = 20; // 예상 아이콘 너비
            const gap = 2;
            
            for (let i = 0; i < deviceElements.length; i++) {
                const totalWidth = iconWidth + gap;
                if (currentWidth + totalWidth <= availableWidth - 30) { // +N 공간 확보
                    visibleCount++;
                    currentWidth += totalWidth;
                } else {
                    break;
                }
            }
            
            // 보이는 아이콘들 추가
            for (let i = 0; i < visibleCount; i++) {
                devicesContainer.appendChild(deviceElements[i]);
            }
            
            // 오버플로우 인디케이터 추가
            if (visibleCount < deviceElements.length) {
                const overflowCount = deviceElements.length - visibleCount;
                const overflowElement = this.createOverflowIndicator(overflowCount, allDeviceData);
                devicesContainer.appendChild(overflowElement);
            }
            
            // 교실에 추가
            roomElement.appendChild(devicesContainer);
            
            // 이름박스 위치 조정
            this.adjustNameBoxPosition(roomElement, 20 + 8);
            return;
        }
        
        const devicesContainer = document.createElement('div');
        devicesContainer.className = 'room-devices';
        devicesContainer.style.position = 'absolute';
        devicesContainer.style.bottom = '4px';
        devicesContainer.style.left = '4px';
        devicesContainer.style.right = '4px';
        devicesContainer.style.overflow = 'hidden'; // 중요: 넘어가는 내용 숨김
        devicesContainer.style.display = 'flex';
        devicesContainer.style.flexWrap = 'wrap';
        devicesContainer.style.gap = '2px';
        devicesContainer.style.alignItems = 'center';
        
        // 장비 타입별 개수 집계 (정규화 적용)
        const normalizedDeviceCounts = {};
        Object.entries(deviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                const normalizedType = this.normalizeDeviceType(type);
                normalizedDeviceCounts[normalizedType] = (normalizedDeviceCounts[normalizedType] || 0) + count;
            }
        });
        
        // 장비 아이콘 생성 (실제 DOM에 추가하지 않고 임시로만 생성)
        const allDeviceData = [];
        const tempContainer = document.createElement('div');
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);
        
        Object.entries(normalizedDeviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                const iconInfo = this.getDeviceIcon(type);
                allDeviceData.push({ type, count, iconInfo });
            }
        });
        
        // 사용 가능한 높이 계산 (이름박스와 여백을 고려)
        const maxDeviceHeight = Math.min(availableHeight * 0.7, 80); // 최대 높이 제한
        
        // 공간이 부족하면 표시하지 않음
        if (maxDeviceHeight < 20) {
            console.log('장비 표시할 공간이 부족합니다:', maxDeviceHeight);
            document.body.removeChild(tempContainer);
            this.adjustNameBoxPosition(roomElement, 0);
            return;
        }
        
        // 실제 장비 요소들 생성
        const deviceElements = [];
        allDeviceData.forEach(({ type, count, iconInfo }) => {
            const deviceIcon = document.createElement('div');
            deviceIcon.className = `device-icon ${iconInfo.class}`;
            deviceIcon.innerHTML = `
                <i class="${iconInfo.icon}"></i>
                <span class="device-count">${count}</span>
            `;
            deviceIcon.title = `${type}: ${count}개`;
            deviceIcon.style.flexShrink = '0'; // 크기 고정
            deviceIcon.style.fontSize = '10px';
            deviceIcon.style.lineHeight = '1';
            deviceIcon.style.whiteSpace = 'nowrap';
            deviceIcon.style.maxWidth = '100%';
            deviceIcon.style.overflow = 'hidden';
            deviceElements.push(deviceIcon);
        });
        
        // 레이아웃 계산
        const result = this.calculateDeviceLayout(tempContainer, roomWidth - 8, maxDeviceHeight, deviceElements, allDeviceData);
        
        // 임시 컨테이너 제거
        document.body.removeChild(tempContainer);
        
        // 실제 표시할 요소들 추가
        result.visibleElements.forEach(element => {
            devicesContainer.appendChild(element);
        });
        
        // 오버플로우 인디케이터 추가
        if (result.overflowCount > 0) {
            const overflowElement = this.createOverflowIndicator(result.overflowCount, allDeviceData);
            devicesContainer.appendChild(overflowElement);
        }
        
        // 컨테이너 크기 설정
        devicesContainer.style.height = result.deviceHeight + 'px';
        
        // 교실에 추가
        roomElement.appendChild(devicesContainer);
        
        // 이름박스 위치 조정 (장비 영역과 겹치지 않도록)
        this.adjustNameBoxPosition(roomElement, result.deviceHeight + 8);
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
            
            // 개체 생성 도구가 활성화된 경우 클릭 이벤트 무시
            const isCreationTool = this.currentTool === 'building' || this.currentTool === 'room' || 
                                 this.currentTool === 'other-space' || this.currentTool === 'add-ap';
            if (isCreationTool) {
                return;
            }
            
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
                // 삭제 도구가 활성화된 경우 - 공통 삭제 메서드 사용
                this.deleteElement(element);
            }
            // else 부분 제거 - 이름 변경 기능 비활성화
        });
        
        element.addEventListener('mousedown', (e) => {
            // 개체 생성 도구가 활성화된 경우 드래그 시작하지 않음
            const isCreationTool = this.currentTool === 'building' || this.currentTool === 'room' || 
                                 this.currentTool === 'other-space' || this.currentTool === 'add-ap';
            if (isCreationTool) {
                e.stopPropagation(); // 이벤트 전파 중단
                return;
            }
            
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
            // 개체 생성 도구가 활성화된 경우 커서 스타일 변경
            const isCreationTool = this.currentTool === 'building' || this.currentTool === 'room' || 
                                 this.currentTool === 'other-space' || this.currentTool === 'add-ap';
            
            // 교실이나 건물인 경우에만 z-index 조정
            if (element.classList.contains('room') || element.classList.contains('building')) {
                // 교실인 경우 임시로 z-index를 높게 설정
                if (element.classList.contains('room')) {
                    element.dataset.originalZIndex = element.style.zIndex || '';
                    element.style.zIndex = '1000'; // 높은 z-index 값
                }
            }
            
            // 개체 생성 도구일 때는 crosshair 커서 사용, 그 외에는 move 커서
            if (isCreationTool) {
                element.style.cursor = 'crosshair';
            } else {
            element.style.cursor = 'move';
            }
            
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
            else if (this.currentTool === 'building' || this.currentTool === 'room' || this.currentTool === 'other-space' || this.currentTool === 'add-ap') {
                // 건물, 교실, 기타공간, AP 추가 도구가 활성화된 경우
                // 클릭 좌표를 저장하고 클릭 이벤트에서 처리
            this.pendingClickCoords = this.getCanvasCoordinates(e);
            }
            else {
                // 기타 도구들도 클릭 좌표 저장
                this.pendingClickCoords = this.getCanvasCoordinates(e);
            }
        }
    }
    
    handleCanvasClickAtCoords(coords) {
        const { x, y } = coords;
        console.log('캔버스 클릭 처리:', { x, y, currentTool: this.currentTool });
        switch (this.currentTool) {
            case 'building':
                console.log('건물 추가 모드에서 클릭됨');
                const buildingName = prompt('건물 이름을 입력하세요:', '새 건물');
                if (buildingName !== null) {
                    console.log('건물 이름 입력됨:', buildingName);
                    this.createBuilding(x, y, buildingName);
                    this.selectTool('select');
                } else {
                    console.log('건물 이름 입력 취소됨');
                }
                break;
            case 'room':
                const roomName = prompt('교실 이름을 입력하세요:', '새 교실');
                if (roomName !== null) {
                    this.createRoom(x, y, roomName);
                    this.selectTool('select');
                }
                break;
            case 'other-space':
                if (this.currentOtherSpaceType) {
                    this.createOtherSpace(x, y, this.currentOtherSpaceType);
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
    
    // 키보드 이벤트 처리
    handleKeyDown(e) {
        // Delete 또는 Backspace 키가 눌렸을 때 선택된 요소 삭제
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            
            // 현재 선택된 요소들 가져오기
            const selectedElements = this.multiSelectManager.getSelectedElements();
            
            if (selectedElements.length > 0) {
                // 다중 선택된 요소들 삭제
                selectedElements.forEach(element => {
                    this.deleteElement(element);
                });
                
                // 선택 해제
                this.multiSelectManager.clearSelection();
            } else {
                // 단일 선택된 요소가 있는지 확인
                const selectedElement = document.querySelector('.draggable.selected');
                if (selectedElement) {
                    this.deleteElement(selectedElement);
                    this.clearSelection();
                }
            }
        }
        
        // ESC 키로 선택 해제
        if (e.key === 'Escape') {
            this.multiSelectManager.clearSelection();
            this.clearSelection();
            this.cancelShapeDrawing();
        }
    }
    
    // 요소 삭제 처리 (공통 메서드)
    deleteElement(element) {
        const elementId = element.dataset.id;
        const isRoom = element.classList.contains('room');
        const isBuilding = element.classList.contains('building');
        const isShape = element.classList.contains('shape');
        
        if (isRoom) {
            // 교실인 경우 - 삭제 확인 후 미배치 교실로 이동
            console.log('교실 삭제 시도 - elementId:', elementId);
            console.log('현재 rooms 데이터:', this.floorPlanData.rooms);
            
            // 더 정확한 검색을 위해 각 room의 ID들을 로깅
            this.floorPlanData.rooms.forEach((room, index) => {
                console.log(`Room ${index}:`, {
                    floorRoomId: room.floorRoomId,
                    classroomId: room.classroomId,
                    id: room.id,
                    roomName: room.roomName
                });
            });
            
            const roomData = this.floorPlanData.rooms.find(room => {
                // 타입을 맞춰서 비교 (문자열과 숫자 모두 처리)
                const match = room.floorRoomId == elementId || 
                             room.classroomId == elementId ||
                             room.id == elementId;
                if (match) {
                    console.log('매칭된 room:', room);
                }
                return match;
            });
            
            console.log('찾은 roomData:', roomData);
            
            if (roomData) {
                // 미배치 교실 목록에 추가
                this.unplacedRoomsManager.addToUnplacedList(roomData);
                
                // DOM에서 요소 제거
                element.remove();
                
                // 데이터에서 제거 (모든 가능한 ID 필드 확인)
                this.floorPlanData.rooms = this.floorPlanData.rooms.filter(room => 
                    room.floorRoomId != elementId && 
                    room.classroomId != elementId &&
                    room.id != elementId
                );
                
                this.showNotification('개체를 삭제했습니다.');
            } else {
                // 데이터를 찾을 수 없는 경우 그냥 삭제
                console.warn('교실 데이터를 찾을 수 없어서 그냥 삭제합니다. elementId:', elementId);
                element.remove();
                this.showNotification('개체를 삭제했습니다.');
            }
        } else if (isBuilding) {
            // 건물인 경우 - 삭제 확인
            const buildingData = this.floorPlanData.buildings.find(building => 
                building.buildingId === elementId);
            
            if (buildingData && confirm(`"${buildingData.buildingName}" 건물을 삭제하시겠습니까?`)) {
                element.remove();
                this.floorPlanData.buildings = this.floorPlanData.buildings.filter(building => 
                    building.buildingId !== elementId);
                this.showNotification('개체를 삭제했습니다.');
            }
        } else if (isShape) {
            // 도형인 경우 - 삭제 확인
            const shapeData = this.floorPlanData.shapes.find(shape => 
                shape.id === elementId);
            
            if (shapeData && confirm('이 도형을 삭제하시겠습니까?')) {
                element.remove();
                this.floorPlanData.shapes = this.floorPlanData.shapes.filter(shape => 
                    shape.id !== elementId);
                this.showNotification('개체를 삭제했습니다.');
            }
        }
    }
    
    createBuilding(x, y, name) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // buildings 배열이 없으면 초기화
        if (!this.floorPlanData.buildings) {
            this.floorPlanData.buildings = [];
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
        
        console.log('건물 생성 시작:', buildingData);
        this.floorPlanData.buildings.push(buildingData);
        console.log('건물 데이터 추가됨, 현재 건물 수:', this.floorPlanData.buildings.length);
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
            xCoordinate: x - 60,
            yCoordinate: y - 48,
            width: 120,
            height: 105,
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
    
    createOtherSpace(x, y, spaceType) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // 임시 ID 생성
        const tempId = 'temp_' + Date.now();
        
        const roomData = {
            roomName: spaceType,
            roomType: 'other-space',
            xCoordinate: x - 60,
            yCoordinate: y - 48,
            width: 120,
            height: 105,
            classroomId: tempId,
            schoolId: this.currentSchoolId,
            borderColor: this.currentBorderColor,
            borderThickness: this.currentBorderThickness
        };
        
        if (!this.floorPlanData.rooms) this.floorPlanData.rooms = [];
        this.floorPlanData.rooms.push(roomData);
        this.renderRoom(roomData);
        this.showNotification(`${spaceType}이(가) 생성되었습니다.`);
    }

    renderElement(type, data) {
        const element = document.createElement('div');
        element.className = `draggable ${type}`;
        element.dataset.type = type;
        const elementId = data.buildingId || data.floorRoomId || data.classroomId || this._getTempId();
        element.dataset.id = elementId;
        
        // 디버깅을 위한 로그 추가
        if (type === 'room') {
            console.log('교실 요소 생성 - ID 설정:', {
                elementId: elementId,
                buildingId: data.buildingId,
                floorRoomId: data.floorRoomId,
                classroomId: data.classroomId,
                roomName: data.roomName
            });
        }
        if (type === 'building') {
            console.log('건물 요소 생성 - ID 설정:', {
                elementId: elementId,
                buildingName: data.buildingName,
                xCoordinate: data.xCoordinate,
                yCoordinate: data.yCoordinate
            });
        }
        
        const name = data.buildingName || data.roomName || `새 ${type}`;
        element.dataset.name = name;
        
        // 기타공간인 경우 추가 데이터 속성 설정
        if (type === 'room' && data.roomType === 'other-space') {
            element.dataset.type = 'other-space';
        }

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
        
        // 새 개체 추가 후 pointer-events 상태 업데이트
        this.updateElementPointerEvents();
        
        return element;
    }
    
    renderBuilding(building) {
        const element = this.renderElement('building', building);
        return element;
    }
    
    renderRoom(room) {
        const element = this.renderElement('room', room);
        
        // 교실이 데이터베이스에 존재하는 경우 장비 정보 로드
        // classroomId가 있고 temp_로 시작하지 않는 경우
        const realClassroomId = room.classroomId || room.id;
        if (realClassroomId && 
            !realClassroomId.toString().startsWith('temp_') && 
            realClassroomId !== 'new') {
            console.log('🔧 교실 장비 로딩 시작:', room.roomName, 'ID:', realClassroomId);
            this.loadAndDisplayDeviceIcons(realClassroomId, element);
        } else {
            console.log('📝 새 교실이므로 장비 로딩 건너뜀:', room.roomName, 'ID:', realClassroomId);
        }
        
        return element;
    }
    
    renderOtherSpace(space) {
        this.renderElement('other-space', space);
    }
    
    selectElement(element) {
        this.clearSelection();
        this.selectedElement = element;
        element.classList.add('selected');
        
        // 선택 시에도 테두리 스타일 유지
        if (element.classList.contains('building') || element.classList.contains('room')) {
            this.restoreBorderStyle(element);
        }
        
        // 도형인 경우 선택 시에도 스타일 유지
        if (element.classList.contains('shape')) {
            this.resizeManager.maintainShapeStyle(element);
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
            
            // 도형인 경우 선택 해제 시에도 스타일 유지
            if (this.selectedElement.classList.contains('shape')) {
                this.resizeManager.maintainShapeStyle(this.selectedElement);
            }
            
            this.selectedElement = null;
        }
        this.multiSelectManager.clearSelection();
    }
    
    editElement(element) {
        // 이름 변경 기능 비활성화
        return;
        
        // 아래 코드는 주석 처리 (기존 기능 보존)
        /*
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
        */
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
            this.showNotification('학교를 선택해주세요.', 'error');
            return;
        }
        
        try {
            const floorPlanData = this.collectFloorPlanData();
            
            const response = await fetch(`/floorplan/save?schoolId=${this.currentSchoolId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(floorPlanData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message);
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('평면도 저장 오류:', error);
            this.showNotification('평면도 저장 중 오류가 발생했습니다.', 'error');
        }
    }
    
    async loadFloorPlan() {
        if (!this.currentSchoolId) {
            this.showNotification('학교를 선택해주세요.', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/floorplan/load?schoolId=${this.currentSchoolId}`);
            const result = await response.json();
            
            if (result.success) {
                // 기존 데이터 초기화
                this.clearCanvas();
                this.floorPlanData = {
                    buildings: [],
                    rooms: [],
                    seats: [],
                    deviceLocations: [],
                    wirelessApLocations: [],
                    shapes: []
                };
                
                // 저장된 데이터로 업데이트
                if (result.rooms) this.floorPlanData.rooms = result.rooms;
                if (result.buildings) this.floorPlanData.buildings = result.buildings;
                if (result.wirelessAps) this.floorPlanData.wirelessApLocations = result.wirelessAps;
                if (result.shapes) this.floorPlanData.shapes = result.shapes;
                if (result.otherSpaces) this.floorPlanData.otherSpaces = result.otherSpaces;
                
                // 평면도 다시 렌더링
                this.renderFloorPlan();
                this.showNotification('평면도가 성공적으로 로드되었습니다.');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('평면도 로드 오류:', error);
            this.showNotification('평면도 로드 중 오류가 발생했습니다.', 'error');
        }
    }
    
    async checkFloorPlanExists() {
        if (!this.currentSchoolId) {
            return false;
        }
        
        try {
            const response = await fetch(`/floorplan/exists?schoolId=${this.currentSchoolId}`);
            const result = await response.json();
            return result.success && result.exists;
        } catch (error) {
            console.error('평면도 존재 확인 오류:', error);
            return false;
        }
    }
    
    collectFloorPlanData() {
        const collectElements = (type) => {
            return Array.from(document.querySelectorAll(`.${type}`)).map(el => {
                const elementData = {
                [`${type}Id`]: el.dataset.id !== 'new' ? el.dataset.id : null,
                [`${type}Name`]: el.dataset.name,
                xCoordinate: parseInt(el.style.left),
                yCoordinate: parseInt(el.style.top),
                width: parseInt(el.style.width),
                height: parseInt(el.style.height),
                borderColor: el.style.borderColor || '#000000',
                borderThickness: parseInt(el.style.borderWidth) || 2,
                    zIndex: parseInt(el.style.zIndex) || 0,
                schoolId: this.currentSchoolId
                };
                
                // 추가 속성들도 포함
                if (el.dataset.classroomId) elementData.classroomId = el.dataset.classroomId;
                if (el.dataset.buildingId) elementData.buildingId = el.dataset.buildingId;
                if (el.dataset.wirelessApId) elementData.wirelessApId = el.dataset.wirelessApId;
                
                return elementData;
            });
        };
        
        // 도형 요소 수집
        const collectShapes = () => {
            return Array.from(document.querySelectorAll('.shape')).map(el => {
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
                    zIndex: parseInt(el.style.zIndex) || 0,
                    schoolId: this.currentSchoolId
                };
                
                // 도형 유형별로 추가 데이터
                if (el.dataset.shapetype === 'curve') {
                    shapeData.svgContent = el.innerHTML;
                }
                
                return shapeData;
            });
        };
        
        // 기타공간 요소 수집
        const collectOtherSpaces = () => {
            return Array.from(document.querySelectorAll('.other-space')).map(el => ({
                id: el.dataset.id,
                type: el.dataset.spacetype,
                xCoordinate: parseInt(el.style.left),
                yCoordinate: parseInt(el.style.top),
                width: parseInt(el.style.width),
                height: parseInt(el.style.height),
                zIndex: parseInt(el.style.zIndex) || 0,
                schoolId: this.currentSchoolId
            }));
        };
        
        // 무선AP 요소 수집
        const collectWirelessAps = () => {
            return Array.from(document.querySelectorAll('.wireless-ap')).map(el => ({
                id: el.dataset.id,
                wirelessApId: el.dataset.wirelessApId,
                xCoordinate: parseInt(el.style.left),
                yCoordinate: parseInt(el.style.top),
                width: parseInt(el.style.width),
                height: parseInt(el.style.height),
                zIndex: parseInt(el.style.zIndex) || 0,
                schoolId: this.currentSchoolId
            }));
        };
        
        return {
            schoolId: this.currentSchoolId,
            buildings: collectElements('building'),
            rooms: collectElements('room'),
            shapes: collectShapes(),
            otherSpaces: collectOtherSpaces(),
            wirelessAps: collectWirelessAps()
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
            this.showNotification('삭제 모드: 교실을 클릭하면 미배치 교실로 이동됩니다. (Delete 키로도 삭제 가능)', 'info');
        } else if (tool === 'building') {
            this.showNotification('건물 추가 모드: 캔버스에 클릭하여 건물을 추가하세요.', 'info');
        } else if (tool === 'room') {
            this.showNotification('교실 추가 모드: 캔버스에 클릭하여 교실을 추가하세요.', 'info');
        } else if (tool === 'other-space') {
            this.showNotification('기타공간 선택: 화장실, EV, 현관 중 하나를 선택하세요.', 'info');
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
        
        // 도형 유형별 스타일 설정
        const thickness = parseInt(this.currentShapeThickness);
        const color = this.currentShapeColor;
        
        // 도형 요소 생성
        const shapeElement = document.createElement('div');
        shapeElement.className = `draggable shape shape-${shapeType}`;
        shapeElement.dataset.id = shapeId;
        shapeElement.dataset.type = 'shape';
        shapeElement.dataset.thickness = thickness.toString();
        shapeElement.dataset.color = color;
        
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
                shapeElement.style.setProperty('height', thickness + 'px', 'important');
                shapeElement.style.setProperty('background-color', color, 'important');
                shapeElement.style.setProperty('--original-thickness', thickness + 'px', 'important');
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
                shapeElement.style.setProperty('border-width', thickness + 'px', 'important');
                shapeElement.style.setProperty('border-style', 'solid', 'important');
                shapeElement.style.setProperty('border-color', color, 'important');
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
                shapeElement.style.setProperty('border-width', thickness + 'px', 'important');
                shapeElement.style.setProperty('border-style', 'solid', 'important');
                shapeElement.style.setProperty('border-color', color, 'important');
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
                shapeElement.style.setProperty('border-width', thickness + 'px', 'important');
                shapeElement.style.setProperty('border-style', 'solid', 'important');
                shapeElement.style.setProperty('border-color', color, 'important');
                shapeElement.style.backgroundColor = 'transparent';
                shapeElement.style.borderRadius = '50%';
                shapeElement.style.setProperty('border-bottom-color', 'transparent', 'important');
                shapeElement.style.setProperty('border-left-color', 'transparent', 'important');
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
        shapeElement.dataset.thickness = borderWidth.toString();
        shapeElement.dataset.color = borderColor;
        
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
            shapeElement.style.setProperty('height', borderWidth + 'px', 'important');
            shapeElement.style.setProperty('background-color', borderColor, 'important');
            shapeElement.style.setProperty('--original-thickness', borderWidth + 'px', 'important');
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
            shapeElement.style.setProperty('border-width', borderWidth + 'px', 'important');
            shapeElement.style.setProperty('border-style', 'solid', 'important');
            shapeElement.style.setProperty('border-color', borderColor, 'important');
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
            shapeElement.style.setProperty('border-width', borderWidth + 'px', 'important');
            shapeElement.style.setProperty('border-style', 'solid', 'important');
            shapeElement.style.setProperty('border-color', borderColor, 'important');
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
            shapeElement.style.setProperty('border-width', borderWidth + 'px', 'important');
            shapeElement.style.setProperty('border-style', 'solid', 'important');
            shapeElement.style.setProperty('border-color', borderColor, 'important');
            shapeElement.style.backgroundColor = 'transparent';
            shapeElement.style.borderRadius = '50%';
            shapeElement.style.setProperty('border-bottom-color', 'transparent', 'important');
            shapeElement.style.setProperty('border-left-color', 'transparent', 'important');
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

    // 장비 레이아웃 계산 (다중 행 지원)
    calculateDeviceLayout(container, roomWidth, maxHeight, deviceElements, allDeviceData) {
        if (deviceElements.length === 0) {
            return {
                visibleElements: [],
                overflowCount: 0,
                deviceHeight: 0,
                rows: 0
            };
        }
        
        const rowHeight = 20; // 아이콘 높이 + 간격 (축소)
        const maxRows = Math.max(1, Math.floor(maxHeight / rowHeight));
        const availableWidth = roomWidth - 8; // 좌우 패딩 고려
        const padding = 2; // 요소 간 간격 축소
        
        // 임시 측정을 위해 컨테이너에 요소들 추가
        deviceElements.forEach(element => container.appendChild(element));
        
        let currentRow = 0;
        let currentRowWidth = 0;
        const visibleElements = [];
        let overflowCount = 0;
        let needsOverflowIndicator = false;
        
        for (let i = 0; i < deviceElements.length; i++) {
            const element = deviceElements[i];
            // 실제 요소 크기 측정
            const elementWidth = element.offsetWidth || 20; // 기본값 축소
            const totalElementWidth = elementWidth + padding;
            
            // 오버플로우 인디케이터가 필요한지 미리 확인
            const remainingElements = deviceElements.length - i;
            const overflowIndicatorWidth = remainingElements > 1 ? 28 : 0; // +N 표시 너비 축소
            
            // 현재 행에 들어갈 수 있는지 확인
            if (currentRowWidth + totalElementWidth > availableWidth) {
                // 다음 행으로 이동
                currentRow++;
                currentRowWidth = 0;
                
                // 최대 행 수 초과 확인
                if (currentRow >= maxRows) {
                    overflowCount = deviceElements.length - i;
                    needsOverflowIndicator = true;
                    break;
                }
            }
            
            // 마지막 행에서 오버플로우 인디케이터 공간 고려
            if (currentRow === maxRows - 1) {
                const spaceForOverflow = remainingElements > 1 ? overflowIndicatorWidth : 0;
                if (currentRowWidth + totalElementWidth + spaceForOverflow > availableWidth) {
                    overflowCount = deviceElements.length - i;
                    needsOverflowIndicator = true;
                    break;
                }
            }
            
            visibleElements.push(element);
            currentRowWidth += totalElementWidth;
        }
        
        // 컨테이너에서 모든 요소 제거 (측정용이었음)
        deviceElements.forEach(element => {
            if (element.parentNode === container) {
                container.removeChild(element);
            }
        });
        
        const actualRows = Math.min(currentRow + 1, maxRows);
        const deviceHeight = actualRows * rowHeight;
        
        return {
            visibleElements,
            overflowCount,
            deviceHeight,
            rows: actualRows,
            needsOverflowIndicator
        };
    }
    
    // 오버플로우 인디케이터 생성
    createOverflowIndicator(count, allDeviceData) {
        const overflowElement = document.createElement('div');
        overflowElement.className = 'device-overflow';
        overflowElement.textContent = `+${count}`;
        overflowElement.title = '더 많은 장비 보기 (호버)';
        overflowElement.style.fontSize = '8px';
        overflowElement.style.fontWeight = '500';
        
        // 호버 이벤트 추가
        let popup = null;
        let popupTimeout = null;
        
        overflowElement.addEventListener('mouseenter', (e) => {
            if (popupTimeout) {
                clearTimeout(popupTimeout);
                popupTimeout = null;
            }
            
            popup = this.createDevicePopup(allDeviceData, e.target);
            document.body.appendChild(popup);
            
            // DOM에 추가된 후 위치 조정
            setTimeout(() => {
                this.positionPopup(popup, e.target);
            }, 10);
        });
        
        overflowElement.addEventListener('mouseleave', () => {
            if (popup) {
                popupTimeout = setTimeout(() => {
                    if (popup && popup.parentNode) {
                        popup.remove();
                    }
                    popup = null;
                    popupTimeout = null;
                }, 200); // 200ms 지연으로 실수로 인한 즉시 사라짐 방지
            }
        });
        
        return overflowElement;
    }
    
    // 장비 상세 팝업 생성
    createDevicePopup(allDeviceData, targetElement) {
        const popup = document.createElement('div');
        popup.className = 'device-popup';
        
        allDeviceData.forEach(({ type, count, iconInfo }) => {
            const item = document.createElement('div');
            item.className = 'device-popup-item';
            item.innerHTML = `
                <i class="${iconInfo.icon}" style="color: ${this.getIconColor(iconInfo.class)}"></i>
                <span>${type}: ${count}개</span>
            `;
            popup.appendChild(item);
        });
        
        return popup;
    }
    
    // 아이콘 색상 매핑
    getIconColor(className) {
        const colorMap = {
            desktop: '#2563eb',
            monitor: '#059669',
            laptop: '#7c3aed',
            printer: '#dc2626',
            projector: '#ea580c',
            tv: '#be185d',
            speaker: '#0891b2',
            network: '#65a30d',
            default: '#6b7280'
        };
        return colorMap[className] || colorMap.default;
    }
    
    // 팝업 위치 조정
    positionPopup(popup, targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        
        let left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);
        let top = targetRect.top - popupRect.height - 10;
        
        // 화면 경계 체크
        if (left + popupRect.width > window.innerWidth) {
            left = window.innerWidth - popupRect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }
        if (top < 10) {
            top = targetRect.bottom + 10;
        }
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }
    
    // 장비 타입 정규화
    normalizeDeviceType(type) {
        if (!type) return '기타';
        
        const typeStr = type.toString().toLowerCase().trim();
        
        // 데스크톱/컴퓨터 관련
        if (typeStr.includes('데스크톱') || typeStr.includes('데스크탑') || 
            typeStr.includes('pc') || typeStr.includes('컴퓨터')) {
            return '데스크톱';
        }
        
        // 모니터 관련
        if (typeStr.includes('모니터') || typeStr.includes('monitor')) {
            return '모니터';
        }
        
        // TV 관련
        if (typeStr.includes('tv') || typeStr.includes('티비') || typeStr.includes('텔레비전')) {
            return 'TV';
        }
        
        // 노트북 관련
        if (typeStr.includes('노트북') || typeStr.includes('laptop')) {
            return '노트북';
        }
        
        // 프린터 관련
        if (typeStr.includes('프린터') || typeStr.includes('printer')) {
            return '프린터';
        }
        
        // 프로젝터 관련
        if (typeStr.includes('프로젝터') || typeStr.includes('projector')) {
            return '프로젝터';
        }
        
        // 스피커 관련
        if (typeStr.includes('스피커') || typeStr.includes('speaker')) {
            return '스피커';
        }
        
        // 네트워크 관련
        if (typeStr.includes('네트워크') || typeStr.includes('스위치') || 
            typeStr.includes('라우터') || typeStr.includes('switch') || 
            typeStr.includes('router') || typeStr.includes('hub')) {
            return '네트워크';
        }
        
        // 기타
        return type;
    }
    
    // 장비 아이콘 정보 가져오기
    getDeviceIcon(type) {
        const normalizedType = this.normalizeDeviceType(type);
        
        const iconMap = {
            '데스크톱': { icon: 'fas fa-server', class: 'desktop' },
            '컴퓨터': { icon: 'fas fa-server', class: 'desktop' },
            'PC': { icon: 'fas fa-server', class: 'desktop' },
            '모니터': { icon: 'fas fa-tv', class: 'monitor' },
            'TV': { icon: 'fas fa-television', class: 'tv' },
            '노트북': { icon: 'fas fa-laptop', class: 'laptop' },
            '프린터': { icon: 'fas fa-print', class: 'printer' },
            '프로젝터': { icon: 'fas fa-video', class: 'projector' },
            '스피커': { icon: 'fas fa-volume-up', class: 'speaker' },
            '네트워크': { icon: 'fas fa-network-wired', class: 'network' },
            '태블릿': { icon: 'fas fa-tablet-alt', class: 'default' },
            '키보드': { icon: 'fas fa-keyboard', class: 'default' },
            '마우스': { icon: 'fas fa-mouse', class: 'default' },
            '웹캠': { icon: 'fas fa-camera', class: 'default' },
            '헤드셋': { icon: 'fas fa-headphones', class: 'default' }
        };
        
        return iconMap[normalizedType] || { icon: 'fas fa-cog', class: 'default' };
    }
    
    // 이름박스 위치 조정 (장비 아이콘과 겹치지 않도록)
    adjustNameBoxPosition(roomElement, deviceHeight) {
        const nameBox = this.nameBoxManager.getNameBoxForElement(roomElement);
        if (!nameBox) return;
        
        const roomHeight = parseInt(roomElement.style.height) || 105;
        const roomWidth = parseInt(roomElement.style.width) || 120;
        
        // 이름박스 크기 계산 (실제 크기 또는 예상 크기)
        const nameBoxRect = nameBox.getBoundingClientRect();
        const nameBoxHeight = nameBoxRect.height || 24;
        const nameBoxWidth = nameBoxRect.width || 60;
        
        // 장비 영역의 위치 계산 (하단에서부터)
        const deviceAreaHeight = deviceHeight + 8; // 장비 영역 + 여백
        const deviceTopY = roomHeight - deviceAreaHeight - 4; // 하단에서 4px 여백
        
        // 사용 가능한 영역 계산 (상단부터 장비 영역까지)
        const availableVerticalSpace = deviceTopY - 8; // 상하 여백 4px씩
        
        // 이름박스 배치 전략
        let finalY;
        
        if (deviceHeight === 0) {
            // 장비가 없으면 중앙 배치
            finalY = (roomHeight - nameBoxHeight) / 2;
        } else {
            // 장비가 있으면 장비 영역 위쪽에 배치
            if (availableVerticalSpace >= nameBoxHeight + 8) {
                // 충분한 공간이 있으면 중앙 배치
                finalY = (availableVerticalSpace - nameBoxHeight) / 2 + 4;
            } else if (availableVerticalSpace >= nameBoxHeight) {
                // 최소 공간만 있으면 상단에 배치
                finalY = 4;
            } else {
                // 공간이 부족하면 장비 영역과 겹치지 않는 선에서 최상단 배치
                finalY = Math.max(4, deviceTopY - nameBoxHeight - 2);
            }
        }
        
        // 교실 경계 내에 유지
        finalY = Math.max(4, Math.min(finalY, roomHeight - nameBoxHeight - 4));
        
        // 이름박스 위치 업데이트 (X축은 중앙 유지, Y축만 조정)
        this.nameBoxManager.updateNameBoxPosition(roomElement, null, finalY);
        
        console.log(`이름박스 위치 조정: 교실크기(${roomWidth}x${roomHeight}), 장비높이(${deviceHeight}), 이름박스위치(${finalY}), 사용가능공간(${availableVerticalSpace})`);
    }
} 