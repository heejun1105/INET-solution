/**
 * 드래그 프리뷰 관리자
 * 드래그 중 요소의 프리뷰를 표시
 */
export default class DragPreviewManager {
    constructor(infiniteCanvasManager) {
        this.infiniteCanvasManager = infiniteCanvasManager;
        this.previewElement = null;
        this.isDragging = false;
    }
    
    /**
     * 프리뷰 생성
     */
    createPreview(data) {
        // 기존 프리뷰 제거
        this.removePreview();
        
        this.previewElement = document.createElement('div');
        this.previewElement.className = 'drag-preview';
        
        // 프리뷰 스타일
        this.previewElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        `;
        
        // 데이터 타입에 따라 다른 스타일 적용
        if (data.type === 'classroom') {
            this.styleClassroomPreview(data);
        } else if (data.type === 'building') {
            this.styleBuildingPreview(data);
        } else {
            this.styleGenericPreview(data);
        }
        
        document.body.appendChild(this.previewElement);
        this.isDragging = true;
        
        console.log('👁️ Drag preview created');
    }
    
    /**
     * 교실 프리뷰 스타일
     */
    styleClassroomPreview(data) {
        const width = data.width || 100;
        const height = data.height || 100;
        
        this.previewElement.innerHTML = `
            <div style="
                width: ${width}px;
                height: ${height}px;
                background: rgba(255, 255, 255, 0.9);
                border: 2px solid #3b82f6;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                color: #1e40af;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            ">
                ${data.name || '교실'}
            </div>
        `;
    }
    
    /**
     * 건물 프리뷰 스타일
     */
    styleBuildingPreview(data) {
        const width = data.width || 200;
        const height = data.height || 200;
        
        this.previewElement.innerHTML = `
            <div style="
                width: ${width}px;
                height: ${height}px;
                background: rgba(219, 234, 254, 0.9);
                border: 3px solid #3b82f6;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: 700;
                color: #1e40af;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            ">
                ${data.name || '건물'}
            </div>
        `;
    }
    
    /**
     * 일반 프리뷰 스타일
     */
    styleGenericPreview(data) {
        const width = data.width || 100;
        const height = data.height || 80;
        
        this.previewElement.innerHTML = `
            <div style="
                width: ${width}px;
                height: ${height}px;
                background: rgba(255, 255, 255, 0.9);
                border: 2px dashed #6b7280;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #4b5563;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            ">
                ${data.name || '요소'}
            </div>
        `;
    }
    
    /**
     * 프리뷰 위치 업데이트
     */
    updatePosition(screenX, screenY, options = {}) {
        if (!this.previewElement) return;
        
        const { snapToGrid = false, gridSize = 20 } = options;
        
        // 프리뷰 크기의 절반만큼 오프셋 (중앙 정렬)
        const rect = this.previewElement.getBoundingClientRect();
        let x = screenX - rect.width / 2;
        let y = screenY - rect.height / 2;
        
        // 그리드 스냅
        if (snapToGrid) {
            // 캔버스 좌표로 변환
            const canvasPos = this.infiniteCanvasManager.screenToCanvas(screenX, screenY);
            
            // 그리드에 스냅
            const snappedX = Math.round(canvasPos.x / gridSize) * gridSize;
            const snappedY = Math.round(canvasPos.y / gridSize) * gridSize;
            
            // 다시 화면 좌표로 변환
            const screenPos = this.infiniteCanvasManager.canvasToScreen(snappedX, snappedY);
            x = screenPos.x - rect.width / 2;
            y = screenPos.y - rect.height / 2;
        }
        
        this.previewElement.style.left = `${x}px`;
        this.previewElement.style.top = `${y}px`;
    }
    
    /**
     * 프리뷰 제거
     */
    removePreview() {
        if (this.previewElement) {
            this.previewElement.remove();
            this.previewElement = null;
            this.isDragging = false;
            console.log('👁️ Drag preview removed');
        }
    }
    
    /**
     * 드롭 가능 영역 표시
     */
    showDropZone(isValid) {
        if (!this.previewElement) return;
        
        if (isValid) {
            this.previewElement.style.opacity = '0.9';
            this.previewElement.style.filter = 'none';
        } else {
            this.previewElement.style.opacity = '0.5';
            this.previewElement.style.filter = 'grayscale(100%)';
        }
    }
    
    /**
     * 스냅 가이드 표시
     */
    showSnapGuide(x, y, orientation = 'both') {
        // 스냅 가이드 라인 생성
        const guide = document.createElement('div');
        guide.className = 'snap-guide';
        
        if (orientation === 'vertical' || orientation === 'both') {
            const vLine = document.createElement('div');
            vLine.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: 0;
                width: 1px;
                height: 100vh;
                background: rgba(59, 130, 246, 0.5);
                pointer-events: none;
                z-index: 9999;
            `;
            document.body.appendChild(vLine);
            
            setTimeout(() => vLine.remove(), 500);
        }
        
        if (orientation === 'horizontal' || orientation === 'both') {
            const hLine = document.createElement('div');
            hLine.style.cssText = `
                position: fixed;
                left: 0;
                top: ${y}px;
                width: 100vw;
                height: 1px;
                background: rgba(59, 130, 246, 0.5);
                pointer-events: none;
                z-index: 9999;
            `;
            document.body.appendChild(hLine);
            
            setTimeout(() => hLine.remove(), 500);
        }
    }
    
    /**
     * 드래그 중인지 확인
     */
    isDraggingElement() {
        return this.isDragging;
    }
    
    /**
     * 프리뷰 스타일 업데이트
     */
    updateStyle(styles) {
        if (!this.previewElement) return;
        
        Object.assign(this.previewElement.style, styles);
    }
}

