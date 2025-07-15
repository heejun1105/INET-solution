export default class DragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.dragElement = null;
        this.dragOffset = { x: 0, y: 0 };
    }

    startDrag(element, e) {
        if (this.isDragging) return;
        if (!this.isValidDraggable(element)) return;
        
        this.isDragging = true;
        this.dragElement = element;

        const zoom = this.floorPlanManager.zoomManager.getCurrentZoom();
        const rect = element.getBoundingClientRect();
        const canvasRect = this.floorPlanManager.canvas.getBoundingClientRect();

        // 마우스 포인터의 캔버스 내 좌표
        const mouseX = (e.clientX - canvasRect.left) / zoom;
        const mouseY = (e.clientY - canvasRect.top) / zoom;
        
        // 엘리먼트의 현재 위치 (style.left, style.top)
        const elementX = parseFloat(element.style.left) || 0;
        const elementY = parseFloat(element.style.top) || 0;

        this.dragOffset = {
            x: mouseX - elementX,
            y: mouseY - elementY
        };

        // bind(this)를 사용하여 올바른 컨텍스트 유지
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        
        document.addEventListener('mousemove', this.boundHandleMouseMove);
        document.addEventListener('mouseup', this.boundHandleMouseUp);
    }

    // 드래그 가능한 객체인지 확인하는 메서드
    isValidDraggable(element) {
        return element.classList.contains('building') || 
               element.classList.contains('room') ||
               element.classList.contains('wireless-ap') ||
               element.classList.contains('shape');
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragElement) return;

        const zoom = this.floorPlanManager.zoomManager.getCurrentZoom();
        const canvasRect = this.floorPlanManager.canvas.getBoundingClientRect();

        let newX = ((e.clientX - canvasRect.left) / zoom) - this.dragOffset.x;
        let newY = ((e.clientY - canvasRect.top) / zoom) - this.dragOffset.y;
        
        // 스냅 기능 적용
        const snappedPosition = this.floorPlanManager.snapManager.snapElement(
            this.dragElement,
            newX,
            newY
        );
        newX = snappedPosition.x;
        newY = snappedPosition.y;

        // 경계 체크
        const elementWidth = parseFloat(this.dragElement.style.width);
        const elementHeight = parseFloat(this.dragElement.style.height);
        const canvasWidth = this.floorPlanManager.canvas.clientWidth;
        const canvasHeight = this.floorPlanManager.canvas.clientHeight;

        newX = Math.max(0, Math.min(newX, canvasWidth - elementWidth));
        newY = Math.max(0, Math.min(newY, canvasHeight - elementHeight));

        this.dragElement.style.left = newX + 'px';
        this.dragElement.style.top = newY + 'px';
    }
    
    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        if (this.dragElement) {
            this.floorPlanManager.snapManager.hideSnapFeedback(this.dragElement);
        }

        this.isDragging = false;
        this.dragElement = null;
        
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }
} 