/**
 * FloorPlanCore.js
 * 평면도 시스템의 핵심 캔버스 엔진
 * 
 * 책임:
 * - 캔버스 초기화 및 생명주기 관리
 * - 좌표계 표준화 및 변환
 * - 상태 관리 (Redux/Vuex 패턴)
 * - 렌더링 파이프라인
 * - 이벤트 조율
 */

export default class FloorPlanCore {
    // 상수 정의
    static MIN_ZOOM = 0.005;  // 더 멀리 줌아웃 가능하도록 감소
    static MAX_ZOOM = 5.0;
    static DEFAULT_ZOOM = 1.0;
    static DEFAULT_GRID_SIZE = 20;
    static DEFAULT_CANVAS_WIDTH = 16000;  // 캔버스 기본 너비
    static DEFAULT_CANVAS_HEIGHT = 12000;  // 캔버스 기본 높이
    
    /**
     * @param {HTMLElement} container - 캔버스를 렌더링할 컨테이너
     * @param {Object} options - 초기화 옵션
     */
    constructor(container, options = {}) {
        if (!container) {
            throw new Error('Container element is required');
        }
        
        console.log('📦 FloorPlanCore 초기화 시작');
        
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        
        // 상태 초기화 (불변성 패턴)
        this.state = {
            // 캔버스 설정
            canvasWidth: options.canvasWidth || FloorPlanCore.DEFAULT_CANVAS_WIDTH,
            canvasHeight: options.canvasHeight || FloorPlanCore.DEFAULT_CANVAS_HEIGHT,
            
            // 뷰포트 상태
            zoom: options.zoom || FloorPlanCore.DEFAULT_ZOOM,
            panX: options.panX || 0,
            panY: options.panY || 0,
            
            // 그리드 설정
            gridSize: options.gridSize || FloorPlanCore.DEFAULT_GRID_SIZE,
            showGrid: options.showGrid !== false,
            snapToGrid: options.snapToGrid !== false,
            
            // 요소들
            elements: [],
            
            // 현재 모드
            currentMode: null,
            
            // 선택 상태
            selectedElements: [],
            hoveredElement: null,
            
            // 모드
            mode: 'select', // select, pan, draw
            tool: null, // rectangle, circle, line, etc.
            activeTool: null, // 현재 활성화된 도구 (십자 커서 유지용)
            
            // 그리기 상태 (도형 프리뷰용)
            drawingShape: null, // { shapeType, startX, startY, endX, endY, width, height, borderColor, borderWidth, backgroundColor }
            
            // 플래그
            isDirty: true, // 리렌더링 필요 여부
            isLoading: false,
            isSaving: false,
            isDragging: false,  // 드래그 중 여부
            isResizing: false   // 리사이즈 중 여부
        };
        
        // 이벤트 리스너 저장 (나중에 제거하기 위함)
        this.listeners = new Map();
        
        // 애니메이션 프레임 ID
        this.animationFrameId = null;
        
        // 초기화
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.startRenderLoop();
        
        console.log('✅ FloorPlanCore 초기화 완료');
    }
    
    /**
     * 캔버스 생성
     */
    createCanvas() {
        // 이미 캔버스가 있으면 생성하지 않음
        if (this.canvas && this.container.contains(this.canvas)) {
            console.log('🖼️ 캔버스가 이미 존재함');
            return;
        }
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'floorplan-canvas';
        this.canvas.style.cssText = `
            display: block;
            cursor: default;
            user-select: none;
            -webkit-user-select: none;
        `;
        
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        // 컨테이너가 표시된 상태에서만 리사이즈
        const rect = this.container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
        this.resize();
        } else {
            console.warn('⚠️ 캔버스 생성 시 컨테이너 크기가 0, 리사이즈 건너뜀');
        }
        
        console.log('🖼️ 캔버스 생성 완료');
    }
    
    /**
     * 캔버스 리사이즈
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        
        // 컨테이너가 숨겨져 있거나 크기가 0이면 리사이즈하지 않음
        if (rect.width <= 0 || rect.height <= 0) {
            console.warn('⚠️ 캔버스 컨테이너 크기가 0입니다. 리사이즈를 건너뜁니다.');
            return;
        }
        
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        
        this.ctx.scale(dpr, dpr);
        
        // 화면 크기 변경 시 현재 줌이 새로운 최소 줌보다 작으면 조정
        const minZoom = this.getMinZoomToFitCanvas();
        if (this.state.zoom < minZoom) {
            this.setState({ zoom: minZoom });
            console.debug('🔍 줌 조정 (resize):', minZoom);
        }
        
        this.markDirty();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 리사이즈
        const resizeHandler = () => this.resize();
        window.addEventListener('resize', resizeHandler);
        this.listeners.set('resize', resizeHandler);
        
        console.log('👂 이벤트 리스너 설정 완료');
    }
    
    /**
     * 렌더링 루프 시작
     */
    startRenderLoop() {
        const render = () => {
            if (this.state.isDirty) {
                this.render();
                this.state.isDirty = false;
            }
            this.animationFrameId = requestAnimationFrame(render);
        };
        
        this.animationFrameId = requestAnimationFrame(render);
        
        console.log('🔄 렌더링 루프 시작');
    }
    
    /**
     * 렌더링 루프 중지
     */
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * 렌더링 (메인 렌더링 파이프라인)
     */
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 1. 완전 초기화: 캔버스 전체를 완전히 클리어하고 리셋
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 변환 초기화
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        
        // 2. 변환 적용 (줌/팬)
        ctx.save();
        ctx.translate(this.state.panX, this.state.panY);
        ctx.scale(this.state.zoom, this.state.zoom);
        
        // 3. 그리드 렌더링
        if (this.state.showGrid) {
            this.renderGrid(ctx);
        }
        
        // 4. 요소들 렌더링 (z-index 순서대로)
        this.renderElements(ctx);
        
        // 4.5. A4 규격 가상선 렌더링
        // - 교실설계 모드(design-classroom)
        // - 장비보기 모드(view-equipment)
        const a4GuideModes = ['design-classroom', 'view-equipment'];
        if (a4GuideModes.includes(this.state.currentMode)) {
            this.renderA4Guide(ctx);
        }
        
        // 5. 선택 표시 (드래그/리사이즈 중이 아닐 때만 - 절대로 스킵!)
        if (!this.state.isDragging && !this.state.isResizing) {
        this.renderSelection(ctx);
        } else {
            // 드래그/리사이즈 중에는 절대로 선택 효과를 그리지 않음
            console.debug('🚫 SKIPPING renderSelection | isDragging:', this.state.isDragging, '| isResizing:', this.state.isResizing);
        }
        
        // 5.5. 그리는 중인 도형 프리뷰 렌더링
        if (this.state.drawingShape) {
            this.renderDrawingShape(ctx);
        }
        
        // 5.6. 선택 박스 렌더링 (다중 선택 드래그 중)
        if (this.state.selectionBox) {
            this.renderMultiSelectionBox(ctx);
        }
        
        // 6. 변환 복원 및 스타일 완전 리셋
        ctx.restore();
        ctx.setLineDash([]); // 점선 스타일 초기화 (중요!)
        
        // 7. UI 오버레이 (줌 레벨 등)
        this.renderOverlay(ctx, width, height);
    }
    
    /**
     * 그리드 렌더링
     */
    renderGrid(ctx) {
        const { gridSize, canvasWidth, canvasHeight, zoom } = this.state;
        
        ctx.save();
        
        // 그리드 선
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1 / zoom;
        
        // 세로선
        for (let x = 0; x <= canvasWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // 가로선
        for (let y = 0; y <= canvasHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        
        // 캔버스 경계선 (더 진하게)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3 / zoom;
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.restore();
    }
    
    /**
     * A4 규격 가상선 렌더링 (교실설계 모드용)
     */
    renderA4Guide(ctx) {
        const { zoom, canvasWidth, canvasHeight } = this.state;
        
        // A4 규격: 210mm x 297mm
        // 96 DPI 기준으로 픽셀 변환: 1mm = 96/25.4 ≈ 3.7795px
        // 5배 크기로 확대
        const mmToPx = 96 / 25.4;
        const scale = 5; // 5배 크기
        const a4Width = 210 * mmToPx * scale;  // 약 3970px (794px * 5)
        const a4Height = 297 * mmToPx * scale; // 약 5615px (1123px * 5)
        
        // 캔버스 중앙에 A4 가상선 배치
        const a4X = (canvasWidth - a4Width) / 2;
        const a4Y = (canvasHeight - a4Height) / 2;
        
        ctx.save();
        
        // A4 가상선 스타일
        ctx.strokeStyle = '#ff6b6b'; // 빨간색
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]); // 점선
        
        // A4 한 칸만 표시 (캔버스 중앙)
        ctx.strokeRect(a4X, a4Y, a4Width, a4Height);
        
        ctx.restore();
    }
    
    /**
     * 요소들 렌더링
     */
    renderElements(ctx) {
        // z-index로 정렬
        const sortedElements = [...this.state.elements].sort(
            (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
        );
        
        for (const element of sortedElements) {
            this.renderElement(ctx, element);
        }
    }
    
    /**
     * 개별 요소 렌더링
     */
    renderElement(ctx, element) {
        ctx.save();
        
        // 투명도 적용
        if (element.opacity != null) {
            ctx.globalAlpha = element.opacity;
        }
        
        // 회전 적용
        if (element.rotation) {
            const centerX = element.xCoordinate + (element.width || 0) / 2;
            const centerY = element.yCoordinate + (element.height || 0) / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((element.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
        }
        
        // 요소 타입별 렌더링
        switch (element.elementType) {
            case 'room':
                this.renderRoom(ctx, element);
                break;
            case 'building':
                this.renderBuilding(ctx, element);
                break;
            case 'wireless_ap':
                this.renderWirelessAp(ctx, element);
                break;
            case 'mdf_idf':
                this.renderMdfIdf(ctx, element);
                break;
            case 'shape':
                this.renderShape(ctx, element);
                break;
            case 'name_box':
                this.renderNameBox(ctx, element);
                break;
            case 'other_space':
                this.renderOtherSpace(ctx, element);
                break;
            case 'equipment_card':
                this.renderEquipmentCard(ctx, element);
                break;
            case 'toilet':
                this.renderToilet(ctx, element);
                break;
            case 'elevator':
                this.renderElevator(ctx, element);
                break;
            case 'entrance':
                this.renderEntrance(ctx, element);
                break;
            case 'stairs':
                this.renderStairs(ctx, element);
                break;
            case 'seat':
                this.renderSeat(ctx, element);
                break;
            case 'device':
                this.renderDevice(ctx, element);
                break;
            case 'text_box':
                this.renderTextBox(ctx, element);
                break;
            default:
                this.renderDefault(ctx, element);
        }
        
        ctx.restore();
    }
    
    /**
     * 교실 렌더링
     */
    renderRoom(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        // 배경 (있으면)
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
        ctx.fillRect(x, y, w, h);
        }
        
        // 테두리는 항상 그리기
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 건물 렌더링
     */
    renderBuilding(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 200;
        const h = element.height || 300;
        
        // 배경 (있으면)
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
        ctx.fillRect(x, y, w, h);
        }
        
        // 테두리는 항상 그리기
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 무선AP 렌더링
     */
    renderWirelessAp(ctx, element) {
        const shapeType = element.shapeType || 'circle';
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const width = element.width || (element.radius ? element.radius * 2 : 40);
        const height = element.height || (element.radius ? element.radius * 2 : 40);
        const backgroundColor = element.backgroundColor || '#ef4444';
        const borderColor = element.borderColor || '#000000';
        const borderWidth = element.borderWidth || 2;
        
        ctx.fillStyle = backgroundColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        
        if (shapeType === 'triangle') {
            const apexX = x + width / 2;
            const apexY = y;
            const leftX = x;
            const leftY = y + height;
            const rightX = x + width;
            const rightY = y + height;
        
        ctx.beginPath();
            ctx.moveTo(apexX, apexY);
            ctx.lineTo(leftX, leftY);
            ctx.lineTo(rightX, rightY);
            ctx.closePath();
        ctx.fill();
            ctx.stroke();
        } else if (shapeType === 'square') {
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.fill();
            ctx.stroke();
        } else if (shapeType === 'diamond') {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, y);
            ctx.lineTo(x + width, centerY);
            ctx.lineTo(centerX, y + height);
            ctx.lineTo(x, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            const radius = element.radius || width / 2;
            const centerX = x + radius;
            const centerY = y + radius;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
        ctx.stroke();
        }

        const label = element.label || element.newLabelNumber || '';
        if (label) {
            const baseSize = Math.min(width, height);
            const fontSize = Math.max(12, baseSize * 0.4);
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.fillStyle = backgroundColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const textX = x + width / 2;
            const textY = y + height + 4;
            ctx.fillText(String(label), textX, textY);
        }
    }
    
    /**
     * MDF(IDF) 렌더링
     */
    renderMdfIdf(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 40;
        const h = element.height || 60;
        
        // 채우기 (빨간색)
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 테두리 (검은색)
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 이름박스 렌더링
     */
    renderNameBox(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 160;  // 120 → 160
        const h = element.height || 40;  // 35 → 40
        
        // 배경과 테두리 제거 (투명하게 렌더링)
        
        // 텍스트 - 박스 높이에 비례하는 폰트 크기 (기존의 1.5배)
        const dynamicFontSize = Math.max(12, (h * 0.5 + 2) * 1.5); // 기존 크기의 1.5배
        ctx.font = `bold ${dynamicFontSize}px ${element.fontFamily || 'Arial, sans-serif'}`;
        ctx.fillStyle = element.textColor || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 텍스트가 박스를 벗어나지 않도록 자동 축소
        const label = element.label || '';
        let textWidth = ctx.measureText(label).width;
        const maxWidth = w - 10; // 좌우 5px 여백
        
        if (textWidth > maxWidth) {
            const scale = maxWidth / textWidth;
            const adjustedFontSize = dynamicFontSize * scale;
            ctx.font = `bold ${adjustedFontSize}px ${element.fontFamily || 'Arial, sans-serif'}`;
        }
        
        ctx.fillText(label, x + w / 2, y + h / 2);
    }
    
    /**
     * 도형 렌더링
     */
    renderShape(ctx, element) {
        const shapeType = element.shapeType || 'rectangle';
        
        switch (shapeType) {
            case 'rectangle':
                this.renderRectangleShape(ctx, element);
                break;
            case 'circle':
                this.renderCircleShape(ctx, element);
                break;
            case 'line':
                this.renderLineShape(ctx, element, false);
                break;
            case 'dashed-line':
                this.renderLineShape(ctx, element, true);
                break;
            case 'text':
                this.renderTextShape(ctx, element);
                break;
            default:
                this.renderDefault(ctx, element);
        }
    }
    
    /**
     * 사각형 도형
     */
    renderRectangleShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 100;
        
        // 배경색 (있으면)
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 테두리는 항상 그리기
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
            ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 원 도형
     */
    renderCircleShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 50;
        const h = element.height || 50;
        
        // 중심점과 반지름 계산 (타원이 아닌 원으로)
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const radius = Math.min(w, h) / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        // 배경색 (있으면)
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fill();
        }
        
        // 테두리는 항상 그리기
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
            ctx.stroke();
    }
    
    /**
     * 선 도형
     */
    renderLineShape(ctx, element, isDashed = false) {
        const startX = element.startX || element.xCoordinate;
        const startY = element.startY || element.yCoordinate;
        const endX = element.endX || (element.xCoordinate + (element.width || 100));
        const endY = element.endY || (element.yCoordinate + (element.height || 0));
        
        ctx.beginPath();
        if (isDashed) {
            ctx.setLineDash([5, 5]);
        }
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.stroke();
        if (isDashed) {
            ctx.setLineDash([]);  // 리셋
        }
    }
    
    /**
     * 텍스트 도형
     */
    renderTextShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const text = element.textContent || '';
        
        ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
        ctx.fillStyle = element.color || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
    }
    
    /**
     * 기타 공간 렌더링
     */
    renderOtherSpace(ctx, element) {
        this.renderRoom(ctx, element); // 교실과 동일하게 렌더링
    }
    
    /**
     * 장비 텍스트 렌더링 (카드 형태 제거, 텍스트만 표시)
     */
    renderEquipmentCard(ctx, element) {
        // 요소 유효성 검사
        if (!element) {
            console.warn('⚠️ renderEquipmentCard: element가 없습니다.');
            return;
        }
        
        const x = element.xCoordinate || 0;
        const y = element.yCoordinate || 0;
        const maxWidth = element.width || 200; // 교실 너비에서 좌우 여백 제외한 너비
        // Core에 저장된 폰트 크기 사용, 없으면 기본값 28px
        const requestedFontSize = this.equipmentFontSize || 28;
        
        // 텍스트 렌더링 품질 향상을 위한 설정
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 텍스트 생성
        let text = element.text;
        if (!text && element.cards && Array.isArray(element.cards)) {
            // cards 배열에서 텍스트 생성
            const textParts = element.cards.map(card => `${card.type} ${card.count}`);
            text = textParts.join(', ');
        } else if (!text && element.deviceType && element.count !== undefined) {
            // 기존 방식 (하위 호환성)
            text = `${element.deviceType} ${element.count}`;
        }
        
        if (!text) {
            ctx.restore();
            return;
        }
        
        // 교실 내부를 넘지 않도록 최대 폰트 크기 계산
        // 줄바꿈을 고려하여 교실 너비와 높이 모두를 체크
        const roomHeight = element.roomHeight || element.height || 200; // 교실 높이
        const maxHeight = roomHeight * 0.4; // 교실 높이의 40%를 최대 텍스트 영역으로 사용 (3/5 지점에서 시작하므로)
        
        // 줄바꿈을 시뮬레이션하여 최대 폰트 크기 계산
        let maxFontSize = requestedFontSize;
        const testFontSize = requestedFontSize;
        ctx.font = `bold ${testFontSize}px Arial, sans-serif`;
        
        // 줄바꿈을 고려한 실제 줄 수와 높이 계산
        const parts = text.split(', ');
        const testLineHeight = testFontSize * 1.2; // 테스트용 줄 간격
        let lines = [];
        let testCurrentLine = ''; // 테스트용 currentLine
        
        parts.forEach((part) => {
            const testText = testCurrentLine ? `${testCurrentLine}, ${part}` : part;
            const metrics = ctx.measureText(testText);
            
            if (metrics.width > maxWidth && testCurrentLine) {
                lines.push(testCurrentLine);
                testCurrentLine = part;
            } else {
                testCurrentLine = testText;
            }
        });
        if (testCurrentLine) {
            lines.push(testCurrentLine);
        }
        
        const totalHeight = lines.length * testLineHeight;
        
        // 높이를 넘으면 폰트 크기 조정
        if (totalHeight > maxHeight) {
            const heightRatio = maxHeight / totalHeight;
            maxFontSize = Math.floor(testFontSize * heightRatio);
            maxFontSize = Math.max(10, maxFontSize);
        }
        
        // 각 줄의 너비도 체크하여 폰트 크기 추가 조정
        ctx.font = `bold ${maxFontSize}px Arial, sans-serif`;
        let widthExceeded = false;
        for (const line of lines) {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxWidth) {
                widthExceeded = true;
                const widthRatio = (maxWidth - 10) / lineWidth;
                const adjustedSize = Math.floor(maxFontSize * widthRatio);
                maxFontSize = Math.min(maxFontSize, adjustedSize);
                maxFontSize = Math.max(10, maxFontSize);
                break;
            }
        }
        
        // 요청된 폰트 크기와 최대 폰트 크기 중 작은 값 사용
        const fontSize = Math.min(requestedFontSize, maxFontSize);
        
        // 텍스트 설정
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = '#ff0000'; // 붉은색
        ctx.textAlign = 'center'; // 중앙 정렬
        ctx.textBaseline = 'middle'; // 중앙 기준선으로 변경 (더 선명한 렌더링)
        
        // 중앙 정렬을 위한 x 좌표 계산 (정수로 반올림하여 선명한 렌더링)
        const centerX = Math.round(x + maxWidth / 2);
        
        // 여러 줄 텍스트 렌더링 (자동 줄바꿈)
        // parts는 이미 위에서 선언되었으므로 재사용
        const lineHeight = fontSize * 1.2; // 실제 렌더링용 줄 간격
        // textBaseline이 'middle'이므로 y 좌표 자체가 텍스트의 중앙이 됨 (정수로 반올림)
        let currentY = Math.round(y);
        let currentLine = '';
        
        parts.forEach((part, index) => {
            // 현재 줄에 추가할 텍스트
            const testText = currentLine ? `${currentLine}, ${part}` : part;
            const metrics = ctx.measureText(testText);
            
            // 줄이 너비를 넘으면 현재 줄 출력하고 다음 줄로
            if (metrics.width > maxWidth && currentLine) {
                // 좌표를 정수로 반올림하여 선명한 렌더링
                ctx.fillText(currentLine, centerX, Math.round(currentY));
                currentY += lineHeight;
                currentLine = part;
            } else {
                currentLine = testText;
            }
            
            // 마지막 부분이면 출력
            if (index === parts.length - 1 && currentLine) {
                // 좌표를 정수로 반올림하여 선명한 렌더링
                ctx.fillText(currentLine, centerX, Math.round(currentY));
            }
        });
        
        ctx.restore();
    }
    
    /**
     * 화장실 렌더링 (아이콘 표시)
     */
    renderToilet(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 140;
        const h = element.height || 180;
        
        // 배경
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 외곽선
        const borderColor = element.borderColor || '#000000';
        const borderWidth = element.borderWidth || 2;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(x, y, w, h);
        
        // 화장실 아이콘 (WC 텍스트) - 이름박스와 같은 높이
        ctx.fillStyle = borderColor;
        ctx.font = 'bold 22px Arial, sans-serif';  // 48 → 22 (교실 이름박스와 동일)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WC', x + w / 2, y + 40 + 20);  // y + 60 (이름박스와 같은 높이)
    }
    
    /**
     * 엘리베이터 렌더링 (아이콘 표시)
     */
    renderElevator(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 140;
        const h = element.height || 180;
        
        // 배경
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 외곽선
        const borderColor = element.borderColor || '#000000';
        const borderWidth = element.borderWidth || 2;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(x, y, w, h);
        
        // EV 텍스트 - 이름박스와 같은 높이
        ctx.fillStyle = borderColor;
        ctx.font = 'bold 22px Arial, sans-serif';  // 48 → 22 (교실 이름박스와 동일)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EV', x + w / 2, y + 40 + 20);  // y + 60 (이름박스와 같은 높이)
    }
    
    /**
     * 현관 렌더링 (사각형, 중앙에 "입구" 텍스트)
     */
    renderEntrance(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 200;
        const h = element.height || 150;

        const borderColor = element.borderColor || '#111827';
        const borderWidth = element.borderWidth || 2;
        const radius = Math.max(10, Math.min(w, h));

        ctx.save();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.lineCap = 'round';

        const hingeLength = radius;

        // 세로 프레임(힌지 측)
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + hingeLength);
        ctx.stroke();

        // 문짝 회전 궤적(사분원)
        ctx.beginPath();
        ctx.arc(x, y, hingeLength, 0, Math.PI / 2, false);
        ctx.stroke();

        ctx.restore();
    }
    
    /**
     * 계단 렌더링 (zigzag 패턴만)
     */
    renderStairs(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 140;
        const h = element.height || 180;
        
        // Zigzag 계단 패턴만 그리기 (배경/외곽선 없음)
        const borderColor = element.borderColor || '#000000';
        const borderWidth = element.borderWidth || 2;
        const stepCount = 7;  // 계단 단수
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth * 2;
        
        ctx.beginPath();
        // 왼쪽 하단에서 시작
        ctx.moveTo(x, y + h);
        
        for (let i = 0; i < stepCount; i++) {
            const stepX = x + (w / stepCount) * i;
            const stepY = y + h - (h / stepCount) * i;
            const nextStepX = x + (w / stepCount) * (i + 1);
            
            // 위로
            ctx.lineTo(stepX, stepY);
            // 오른쪽으로
            ctx.lineTo(nextStepX, stepY);
        }
        
        // 마지막 단 연결
        ctx.lineTo(x + w, y);
        ctx.stroke();
    }
    
    /**
     * 자리(사각형) 렌더링
     */
    renderSeat(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 500;
        const h = element.height || 500;
        
        // 배경
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 테두리
        ctx.strokeStyle = element.borderColor || '#3b82f6';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 장비 카드 렌더링
     */
    renderDevice(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 150;
        const h = element.height || 150;
        
        // 배경
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        // 테두리
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
        
        // 장비 정보 표시 (장비 카드 형태로)
        if (element.deviceData) {
            const deviceData = typeof element.deviceData === 'string' 
                ? JSON.parse(element.deviceData) 
                : element.deviceData;
            
            // 줌 레벨에 따라 폰트 크기 조정 (가시성 개선을 위해 최소값 증가)
            const zoom = this.state.zoom || 1.0;
            const baseFontSize = Math.max(10, Math.min(14, w * 0.1 / zoom));
            const headerFontSize = Math.max(12, Math.min(16, w * 0.12 / zoom));
            const smallFontSize = Math.max(9, Math.min(12, w * 0.09 / zoom));
            
            const padding = 5;
            const headerHeight = headerFontSize + padding * 2;
            const lineHeight = smallFontSize + 3; // 줄 간격 증가
            
            // 헤더 배경 (장비종류)
            const headerGradient = ctx.createLinearGradient(x, y, x, y + headerHeight);
            headerGradient.addColorStop(0, '#3b82f6');
            headerGradient.addColorStop(1, '#2563eb');
            ctx.fillStyle = headerGradient;
            ctx.fillRect(x, y, w, headerHeight);
            
            // 헤더 텍스트 (장비종류) - 가시성 개선
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${headerFontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 텍스트 그림자 추가
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const deviceType = deviceData.type || '장비';
            ctx.fillText(deviceType, x + w / 2, y + headerHeight / 2);
            ctx.shadowBlur = 0; // 그림자 초기화
            
            // 본문 영역
            let currentY = y + headerHeight + padding;
            
            // 텍스트 스타일 설정 (가시성 개선)
            ctx.fillStyle = '#1f2937'; // 더 진한 색상
            ctx.font = `bold ${smallFontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // 고유번호
            const uidLabel = '고유번호:';
            const uidValue = deviceData.uidNumber || '-';
            ctx.fillText(uidLabel, x + padding, currentY);
            ctx.font = `${smallFontSize}px Arial`; // 값은 일반 폰트
            ctx.fillText(uidValue, x + padding + w * 0.38, currentY);
            currentY += lineHeight;
            
            // 관리번호
            ctx.font = `bold ${smallFontSize}px Arial`; // 라벨은 볼드
            const manageLabel = '관리번호:';
            const manageValue = deviceData.manageNumber || '-';
            ctx.fillText(manageLabel, x + padding, currentY);
            ctx.font = `${smallFontSize}px Arial`;
            ctx.fillText(manageValue, x + padding + w * 0.38, currentY);
            currentY += lineHeight;
            
            // 관리자
            ctx.font = `bold ${smallFontSize}px Arial`;
            const operatorLabel = '관리자:';
            const operatorValue = deviceData.operatorName || '-';
            ctx.fillText(operatorLabel, x + padding, currentY);
            ctx.font = `${smallFontSize}px Arial`;
            ctx.fillText(operatorValue, x + padding + w * 0.38, currentY);
            currentY += lineHeight;
            
            // 세트번호
            ctx.font = `bold ${smallFontSize}px Arial`;
            const setLabel = '세트번호:';
            const setValue = deviceData.setType || '-';
            ctx.fillText(setLabel, x + padding, currentY);
            ctx.font = `${smallFontSize}px Arial`;
            ctx.fillText(setValue, x + padding + w * 0.38, currentY);
        } else {
            // deviceData가 없는 경우 기본 표시
            ctx.font = `${Math.min(12, w * 0.08)}px Arial`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('장비', x + w / 2, y + h / 2);
        }
    }
    
    /**
     * 텍스트 상자 렌더링
     */
    renderTextBox(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 200;
        const h = element.height || 50;
        
        // 배경
        ctx.fillStyle = element.backgroundColor || '#ffffff';
        ctx.fillRect(x, y, w, h);
        
        // 테두리
        ctx.strokeStyle = element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 1;
        ctx.strokeRect(x, y, w, h);
        
        // 텍스트
        const fontSize = element.fontSize || 16;
        ctx.font = `${fontSize}px ${element.fontFamily || 'Arial, sans-serif'}`;
        ctx.fillStyle = element.textColor || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const label = element.label || '';
        ctx.fillText(label, x + w / 2, y + h / 2);
    }
    
    /**
     * 기본 렌더링
     */
    renderDefault(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 50;
        const h = element.height || 50;
        
        ctx.fillStyle = element.color || '#cccccc';
        ctx.fillRect(x, y, w, h);
    }
    
    /**
     * 라벨 렌더링
     */
    renderLabel(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(element.label, x + w / 2, y + h / 2);
    }
    
    /**
     * 선택 표시 렌더링
     * 주의: 이 메서드는 render()에서 이미 isDragging/isResizing 체크 후 호출됨
     */
    renderSelection(ctx) {
        // 이중 방어: render()에서 이미 체크했지만, 만약을 대비해 다시 체크
        if (this.state.isDragging || this.state.isResizing) {
            console.warn('⚠️ renderSelection이 드래그/리사이즈 중에 호출됨! 이는 버그일 수 있습니다.');
            return;
        }
        
        // 선택된 요소들에 대한 시각적 효과 렌더링
        for (const element of this.state.selectedElements) {
            this.renderSelectionBox(ctx, element);
            this.renderResizeHandles(ctx, element);
        }
        
        // 호버 효과
        if (this.state.hoveredElement) {
            this.renderHoverBox(ctx, this.state.hoveredElement);
        }
    }
    
    /**
     * 크기 조정 핸들 렌더링
     */
    renderResizeHandles(ctx, element) {
        const handleSize = 8 / this.state.zoom;  // 줌에 관계없이 화면에서 8px
        
        // 선/점선의 경우 양끝 핸들만 표시
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            const startX = element.startX || element.xCoordinate;
            const startY = element.startY || element.yCoordinate;
            const endX = element.endX || (element.xCoordinate + (element.width || 100));
            const endY = element.endY || (element.yCoordinate + (element.height || 0));
            
            const handles = [
                { x: startX, y: startY, type: 'start' },
                { x: endX, y: endY, type: 'end' }
            ];
            
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / this.state.zoom;
            
            handles.forEach(handle => {
                ctx.beginPath();
                ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        } else {
            // 일반 요소의 경우 8방향 핸들
            const x = element.xCoordinate;
            const y = element.yCoordinate;
            const w = element.width || 100;
            const h = element.height || 80;
            
            const handles = [
                { x: x, y: y }, // nw (좌상)
                { x: x + w, y: y }, // ne (우상)
                { x: x, y: y + h }, // sw (좌하)
                { x: x + w, y: y + h }, // se (우하)
                { x: x + w / 2, y: y }, // n (상)
                { x: x + w / 2, y: y + h }, // s (하)
                { x: x, y: y + h / 2 }, // w (좌)
                { x: x + w, y: y + h / 2 }, // e (우)
            ];
            
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 / this.state.zoom;
            
            handles.forEach(handle => {
                ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
                ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            });
        }
    }
    
    /**
     * 선택 박스 렌더링
     */
    renderSelectionBox(ctx, element) {
        ctx.save();
        
        // 선/점선의 경우 선 자체를 강조
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            const startX = element.startX || element.xCoordinate;
            const startY = element.startY || element.yCoordinate;
            const endX = element.endX || (element.xCoordinate + (element.width || 100));
            const endY = element.endY || (element.yCoordinate + (element.height || 0));
            
            // 선택된 선 주변에 반투명 선 그리기
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.lineWidth = (element.borderWidth || 2) + 6 / this.state.zoom;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        } else {
            // 일반 요소의 경우 사각형 박스
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / this.state.zoom;
        ctx.setLineDash([5 / this.state.zoom, 5 / this.state.zoom]);
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
            
            // 현관, 계단의 경우 회전 핸들 추가
            if (element.elementType === 'entrance' || element.elementType === 'stairs') {
                const handleSize = 10 / this.state.zoom;  // 더 크게 (8 -> 10)
                const handleDistance = 30 / this.state.zoom;
                const centerX = x + w / 2;
                const centerY = y + h / 2;
                
                // 회전 핸들 (상단 중앙)
                ctx.setLineDash([]);
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 / this.state.zoom;
                ctx.beginPath();
                ctx.arc(centerX, y - handleDistance, handleSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // 회전 핸들 연결선
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2 / this.state.zoom;  // 더 두껍게 (1 -> 2)
                ctx.beginPath();
                ctx.moveTo(centerX, y);
                ctx.lineTo(centerX, y - handleDistance);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
    
    /**
     * 호버 박스 렌더링
     */
    renderHoverBox(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1 / this.state.zoom;
        ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        ctx.restore();
    }
    
    /**
     * 그리는 중인 도형 프리뷰 렌더링
     */
    renderDrawingShape(ctx) {
        const shape = this.state.drawingShape;
        if (!shape) return;
        
        ctx.save();
        ctx.globalAlpha = 0.5; // 반투명 프리뷰
        
        const { shapeType, startX, startY, width, height, borderColor, borderWidth, backgroundColor } = shape;
        
        if (shapeType === 'rectangle') {
            // 사각형
            if (backgroundColor && backgroundColor !== 'transparent') {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(startX, startY, width, height);
            }
            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = borderWidth || 2;
            ctx.strokeRect(startX, startY, width, height);
        } else if (shapeType === 'circle') {
            // 원
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;
            const radius = Math.min(width, height) / 2;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            
            if (backgroundColor && backgroundColor !== 'transparent') {
                ctx.fillStyle = backgroundColor;
                ctx.fill();
            }
            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = borderWidth || 2;
            ctx.stroke();
        } else if (shapeType === 'line') {
            // 직선 - endX, endY 사용
            const lineEndX = shape.endX || (startX + width);
            const lineEndY = shape.endY || (startY + height);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = borderWidth || 2;
            ctx.stroke();
        } else if (shapeType === 'dashed-line') {
            // 점선 - endX, endY 사용
            const lineEndX = shape.endX || (startX + width);
            const lineEndY = shape.endY || (startY + height);
            
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(startX, startY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = borderWidth || 2;
            ctx.stroke();
            ctx.setLineDash([]); // 리셋
        } else if (shapeType === 'entrance') {
            const absWidth = Math.abs(width);
            const absHeight = Math.abs(height);
            const minX = Math.min(startX, startX + width);
            const minY = Math.min(startY, startY + height);
            const centerX = minX + absWidth / 2;
            const centerY = minY + absHeight / 2;
            const doorSize = Math.min(absWidth, absHeight);

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(Math.PI);
            ctx.translate(-centerX, -centerY);

            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = borderWidth || 2;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(minX, minY);
            ctx.lineTo(minX, minY + doorSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(minX, minY, doorSize, 0, Math.PI / 2, false);
            ctx.stroke();

        ctx.restore();

        } else if (shapeType === 'stairs') {
            // 계단 (zigzag 패턴만)
            const stepCount = 7;
            
            ctx.strokeStyle = borderColor || '#000000';
            ctx.lineWidth = (borderWidth || 2) * 2;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY + height);
            
            for (let i = 0; i < stepCount; i++) {
                const stepX = startX + (width / stepCount) * i;
                const stepY = startY + height - (height / stepCount) * i;
                const nextStepX = startX + (width / stepCount) * (i + 1);
                
                ctx.lineTo(stepX, stepY);
                ctx.lineTo(nextStepX, stepY);
            }
            
            ctx.lineTo(startX + width, startY);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * 다중 선택 박스 렌더링 (드래그 중)
     */
    renderMultiSelectionBox(ctx) {
        const box = this.state.selectionBox;
        if (!box) return;
        
        const minX = Math.min(box.startX, box.endX);
        const minY = Math.min(box.startY, box.endY);
        const maxX = Math.max(box.startX, box.endX);
        const maxY = Math.max(box.startY, box.endY);
        const width = maxX - minX;
        const height = maxY - minY;
        
        ctx.save();
        
        // 반투명 파란색 배경
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(minX, minY, width, height);
        
        // 파란색 점선 테두리
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / this.state.zoom;
        ctx.setLineDash([5 / this.state.zoom, 5 / this.state.zoom]);
        ctx.strokeRect(minX, minY, width, height);
        
        ctx.restore();
    }
    
    /**
     * 오버레이 렌더링 (UI 정보)
     */
    renderOverlay(ctx, width, height) {
        // 줌 레벨 표시는 UI 컴포넌트(zoom-display)에서 처리
        // 중복 표시 방지를 위해 캔버스 오버레이 제거
    }
    
    // ===== 좌표계 변환 =====
    
    /**
     * 화면 좌표 → 캔버스 좌표
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x_screen = screenX - rect.left;
        const y_screen = screenY - rect.top;
        
        const x_canvas = (x_screen - this.state.panX) / this.state.zoom;
        const y_canvas = (y_screen - this.state.panY) / this.state.zoom;
        
        return { x: x_canvas, y: y_canvas };
    }
    
    /**
     * 캔버스 좌표 → 화면 좌표
     */
    canvasToScreen(canvasX, canvasY) {
        const rect = this.canvas.getBoundingClientRect();
        
        const x_screen = canvasX * this.state.zoom + this.state.panX + rect.left;
        const y_screen = canvasY * this.state.zoom + this.state.panY + rect.top;
        
        return { x: x_screen, y: y_screen };
    }
    
    /**
     * 그리드에 스냅
     */
    snapToGrid(x, y) {
        if (!this.state.snapToGrid) {
            return { x, y };
        }
        
        const gridSize = this.state.gridSize;
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
    
    // ===== 상태 관리 =====
    
    /**
     * 상태 업데이트 (불변성 보장)
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.markDirty();
    }
    
    /**
     * 그리는 중인 도형 업데이트 (프리뷰용)
     * @param {Object|null} shapeData - 도형 데이터 또는 null (제거)
     */
    updateDrawingShape(shapeData) {
        this.state.drawingShape = shapeData;
        this.markDirty();
    }
    
    /**
     * 줌 설정
     */
    setZoom(zoom, centerX = null, centerY = null) {
        const minZoom = this.getMinZoomToFitCanvas();
        const newZoom = Math.max(minZoom, Math.min(FloorPlanCore.MAX_ZOOM, zoom));
        
        if (centerX != null && centerY != null) {
            // 특정 점을 중심으로 줌
            const rect = this.canvas.getBoundingClientRect();
            const x_screen = centerX - rect.left;
            const y_screen = centerY - rect.top;
            
            const x_canvas = (x_screen - this.state.panX) / this.state.zoom;
            const y_canvas = (y_screen - this.state.panY) / this.state.zoom;
            
            const newPanX = x_screen - x_canvas * newZoom;
            const newPanY = y_screen - y_canvas * newZoom;
            
            // 줌 먼저 설정하고 팬 경계 체크
            this.setState({ zoom: newZoom });
            this.setPan(newPanX, newPanY);
        } else {
            // 줌만 변경하고 현재 팬 위치 재검증
            this.setState({ zoom: newZoom });
            this.setPan(this.state.panX, this.state.panY);
        }
    }
    
    /**
     * 팬 설정 (경계 제한 포함)
     */
    setPan(panX, panY) {
        // 뷰포트 크기
        const viewportWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const viewportHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 캔버스 크기 (줌 적용)
        const scaledCanvasWidth = this.state.canvasWidth * this.state.zoom;
        const scaledCanvasHeight = this.state.canvasHeight * this.state.zoom;
        
        // 팬 범위 제한 계산
        // 최소값: 캔버스 오른쪽 끝이 뷰포트 왼쪽 끝에 닿을 때
        // 최대값: 캔버스 왼쪽 끝이 뷰포트 오른쪽 끝에 닿을 때
        const minPanX = viewportWidth - scaledCanvasWidth;
        const maxPanX = 0;
        const minPanY = viewportHeight - scaledCanvasHeight;
        const maxPanY = 0;
        
        // 팬 값을 범위 내로 제한
        const clampedPanX = Math.max(minPanX, Math.min(maxPanX, panX));
        const clampedPanY = Math.max(minPanY, Math.min(maxPanY, panY));
        
        this.setState({ 
            panX: clampedPanX, 
            panY: clampedPanY 
        });
    }
    
    /**
     * 요소 추가
     */
    addElement(element) {
        const elements = [...this.state.elements, element];
        this.setState({ elements });
    }
    
    /**
     * 요소 업데이트
     */
    updateElement(elementId, updates) {
        // elements 배열 업데이트
        const elements = this.state.elements.map(el =>
            el.id === elementId ? { ...el, ...updates } : el
        );
        
        // selectedElements도 함께 업데이트 (중요!)
        const selectedElements = this.state.selectedElements.map(el =>
            el.id === elementId ? { ...el, ...updates } : el
        );
        
        // 두 배열 모두 업데이트
        this.state.elements = elements;
        this.state.selectedElements = selectedElements;
        this.markDirty();
    }
    
    /**
     * 요소 삭제
     */
    removeElement(elementId) {
        const elements = this.state.elements.filter(el => el.id !== elementId);
        this.setState({ elements });
    }
    
    /**
     * 모든 요소 설정
     */
    setElements(elements) {
        this.setState({ elements: [...elements] });
    }
    
    /**
     * 선택 설정
     */
    setSelection(elementIds) {
        const selectedElements = this.state.elements.filter(el =>
            elementIds.includes(el.id)
        );
        this.setState({ selectedElements });
    }
    
    /**
     * 리렌더링 필요 표시
     */
    markDirty() {
        this.state.isDirty = true;
    }
    
    // ===== 줌 컨트롤 =====
    
    /**
     * 확대 (10% 증가) - 화면 중앙 기준
     */
    zoomIn() {
        const currentZoom = this.state.zoom;
        const newZoom = Math.min(currentZoom * 1.1, FloorPlanCore.MAX_ZOOM);
        
        // 화면 중앙을 기준으로 줌
        const screenWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const screenHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        
        // 현재 화면 중앙의 캔버스 좌표 계산
        const canvasCenterX = (centerX - this.state.panX) / currentZoom;
        const canvasCenterY = (centerY - this.state.panY) / currentZoom;
        
        // 새로운 줌에서 같은 캔버스 지점이 화면 중앙에 오도록 pan 조정
        const newPanX = centerX - canvasCenterX * newZoom;
        const newPanY = centerY - canvasCenterY * newZoom;
        
        this.setState({ 
            zoom: newZoom,
            panX: newPanX,
            panY: newPanY
        });
        
        console.debug('🔍 확대:', newZoom.toFixed(2));
    }
    
    /**
     * 축소 (10% 감소) - 화면 중앙 기준
     */
    zoomOut() {
        const currentZoom = this.state.zoom;
        const minZoom = this.getMinZoomToFitCanvas();
        const newZoom = Math.max(currentZoom / 1.1, minZoom);
        
        // 화면 중앙을 기준으로 줌
        const screenWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const screenHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        
        // 현재 화면 중앙의 캔버스 좌표 계산
        const canvasCenterX = (centerX - this.state.panX) / currentZoom;
        const canvasCenterY = (centerY - this.state.panY) / currentZoom;
        
        // 새로운 줌에서 같은 캔버스 지점이 화면 중앙에 오도록 pan 조정
        const newPanX = centerX - canvasCenterX * newZoom;
        const newPanY = centerY - canvasCenterY * newZoom;
        
        this.setState({ 
            zoom: newZoom,
            panX: newPanX,
            panY: newPanY
        });
        
        console.debug('🔍 축소:', newZoom.toFixed(2), '(최소:', minZoom.toFixed(2), ')');
    }
    
    /**
     * 줌 초기화 (100%) - 화면 중앙 기준
     */
    resetZoom() {
        const currentZoom = this.state.zoom;
        const newZoom = FloorPlanCore.DEFAULT_ZOOM;
        
        // 화면 중앙을 기준으로 줌
        const screenWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const screenHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        
        // 현재 화면 중앙의 캔버스 좌표 계산
        const canvasCenterX = (centerX - this.state.panX) / currentZoom;
        const canvasCenterY = (centerY - this.state.panY) / currentZoom;
        
        // 새로운 줌에서 같은 캔버스 지점이 화면 중앙에 오도록 pan 조정
        const newPanX = centerX - canvasCenterX * newZoom;
        const newPanY = centerY - canvasCenterY * newZoom;
        
        this.setState({ 
            zoom: newZoom,
            panX: newPanX,
            panY: newPanY
        });
        
        console.debug('🔍 줌 초기화 (100%)');
    }
    
    /**
     * 모든 요소가 보이도록 자동 피팅
     */
    fitToElements() {
        const elements = this.state.elements;
        
        if (!elements || elements.length === 0) {
            // 요소가 없으면 중앙으로
            this.setState({
                panX: 0,
                panY: 0,
                zoom: FloorPlanCore.DEFAULT_ZOOM
            });
            this.markDirty();
            return;
        }
        
        // 모든 요소의 경계 계산
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        elements.forEach(element => {
            const x = element.x || element.xCoordinate || 0;
            const y = element.y || element.yCoordinate || 0;
            const width = element.width || 0;
            const height = element.height || 0;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });
        
        // 여유 공간 추가 (20%)
        const padding = 0.2;
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        minX -= contentWidth * padding;
        minY -= contentHeight * padding;
        maxX += contentWidth * padding;
        maxY += contentHeight * padding;
        
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        
        // 캔버스 크기
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 적절한 줌 레벨 계산
        const zoomX = canvasWidth / totalWidth;
        const zoomY = canvasHeight / totalHeight;
        const newZoom = Math.min(zoomX, zoomY, FloorPlanCore.MAX_ZOOM);
        
        // 중앙 위치 계산
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const newPanX = canvasWidth / 2 - centerX * newZoom;
        const newPanY = canvasHeight / 2 - centerY * newZoom;
        
        this.setState({
            zoom: newZoom,
            panX: newPanX,
            panY: newPanY
        });
        
        this.markDirty();
        
        console.debug('📐 자동 피팅:', { zoom: newZoom, panX: newPanX, panY: newPanY });
    }
    
    /**
     * 캔버스 중앙으로 뷰 설정 (100% 배율)
     */
    centerView() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 논리적 캔버스의 중앙 좌표
        const logicalCenterX = this.state.canvasWidth / 2;
        const logicalCenterY = this.state.canvasHeight / 2;
        
        // 100% 줌에서 화면 중앙에 논리적 캔버스 중앙 배치
        const newPanX = canvasWidth / 2 - logicalCenterX * 1.0;
        const newPanY = canvasHeight / 2 - logicalCenterY * 1.0;
        
        this.setState({
            zoom: 1.0,
            panX: newPanX,
            panY: newPanY
        });
        
        this.markDirty();
        
        console.debug('🎯 중앙 뷰 설정:', { zoom: 1.0, panX: newPanX, panY: newPanY });
    }
    
    /**
     * 캔버스가 화면을 채우는 최소 줌 계산
     * (캔버스 밖 영역이 보이지 않도록)
     */
    getMinZoomToFitCanvas() {
        const screenWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const screenHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 캔버스가 화면을 완전히 채우려면 필요한 최소 줌
        const zoomX = screenWidth / this.state.canvasWidth;
        const zoomY = screenHeight / this.state.canvasHeight;
        
        // 둘 중 큰 값을 사용 (캔버스가 화면을 완전히 채우도록)
        const minZoom = Math.max(zoomX, zoomY);
        
        // 절대 최소값보다는 커야 함
        return Math.max(minZoom, FloorPlanCore.MIN_ZOOM);
    }
    
    // ===== 정리 =====
    
    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ FloorPlanCore 정리 시작');
        
        this.stopRenderLoop();
        
        // 이벤트 리스너 제거
        this.listeners.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        this.listeners.clear();
        
        // 캔버스 제거
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        console.log('✅ FloorPlanCore 정리 완료');
    }
}

