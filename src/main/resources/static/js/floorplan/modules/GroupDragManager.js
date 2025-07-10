export default class GroupDragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
        this.startX = 0;
        this.startY = 0;
    }

    startGroupDrag(elements, e) {
        if (elements.length === 0) return false;
        
        this.dragElements = [...elements];
        this.startPositions = elements.map(element => ({
            element: element,
            x: parseInt(element.style.left) || 0,
            y: parseInt(element.style.top) || 0
        }));
        
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
        
        // 드래그 중 시각적 효과
        this.dragElements.forEach(element => {
            element.style.zIndex = '1000';
            element.style.opacity = '0.8';
            element.style.pointerEvents = 'none'; // 마우스 이벤트 비활성화
        });
        
        // 캔버스 커서 변경
        document.getElementById('canvasContent').style.cursor = 'move';
        
        return true;
    }

    updateGroupDrag(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        // 줌 레벨 적용 (zoomManager가 있고 초기화되었을 때만)
        let zoomLevel = 1.0;
        if (this.floorPlanManager.zoomManager && this.floorPlanManager.zoomManager.initialized) {
            zoomLevel = this.floorPlanManager.zoomManager.getCurrentZoom();
        }
        const adjustedDeltaX = deltaX / zoomLevel;
        const adjustedDeltaY = deltaY / zoomLevel;
        
        // 기준점(첫 번째 요소)의 새 위치를 먼저 계산
        const firstElementData = this.startPositions[0];
        const baseNewX = firstElementData.x + adjustedDeltaX;
        const baseNewY = firstElementData.y + adjustedDeltaY;
    
        // 기준점 위치에 스냅 적용하여 스냅 오프셋 계산
        const snappedPosition = this.floorPlanManager.snapManager.snapElement(firstElementData.element, baseNewX, baseNewY);
        const snapDeltaX = snappedPosition.x - baseNewX;
        const snapDeltaY = snappedPosition.y - baseNewY;

        // 모든 요소에 동일한 오프셋을 적용하여 위치 업데이트
        this.startPositions.forEach(({ element, x, y }) => {
            const newX = Math.max(0, x + adjustedDeltaX + snapDeltaX);
            const newY = Math.max(0, y + adjustedDeltaY + snapDeltaY);
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        });
    }

    endGroupDrag() {
        if (!this.isDragging) return;
        
        // 드래그 효과 제거
        this.dragElements.forEach(element => {
            element.style.zIndex = '';
            element.style.opacity = '';
            element.style.pointerEvents = ''; // 마우스 이벤트 다시 활성화
            this.floorPlanManager.snapManager.hideSnapFeedback(element);
        });
        
        // 캔버스 커서 원래대로
        this.floorPlanManager.updateCanvasCursor();
        
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
        
        this.floorPlanManager.showNotification('그룹 이동이 완료되었습니다.');
    }

    cancelGroupDrag() {
        if (!this.isDragging) return;
        
        // 원래 위치로 복원
        this.startPositions.forEach(({ element, x, y }) => {
            element.style.left = x + 'px';
            element.style.top = y + 'px';
            element.style.zIndex = '';
            element.style.opacity = '';
            element.style.pointerEvents = ''; // 마우스 이벤트 다시 활성화
        });
        
        // 캔버스 커서 원래대로
        this.floorPlanManager.updateCanvasCursor();
        
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
    }
} 