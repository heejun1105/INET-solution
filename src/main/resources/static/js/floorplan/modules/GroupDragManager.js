export default class GroupDragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.elements = [];
        this.startPositions = [];
        this.initialMousePos = { x: 0, y: 0 };
        this.currentMousePos = { x: 0, y: 0 };
    }
    
    startGroupDrag(elements, e) {
        if (this.isDragging || !elements || elements.length === 0) return;
        
        this.isDragging = true;
        this.elements = elements;
        
        // 각 요소의 초기 위치 저장
        this.startPositions = elements.map(el => ({
            x: parseInt(el.style.left) || 0,
            y: parseInt(el.style.top) || 0
        }));
        
        // FloorPlanManager의 좌표 계산 메서드를 사용하여 초기 마우스 위치 저장
        const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
        this.initialMousePos = { 
            x: canvasCoords.x,
            y: canvasCoords.y
        };
        
        this.currentMousePos = { ...this.initialMousePos };
        
        // 모든 요소에 높은 z-index 설정
        for (const element of elements) {
            element.dataset.originalZIndex = element.style.zIndex || '';
            element.style.zIndex = '1000'; // 높은 z-index 값
        }
    }
    
    updateGroupDrag(e) {
        if (!this.isDragging) return;
        
        // FloorPlanManager의 좌표 계산 메서드를 사용하여 현재 마우스 위치 계산
        const currentCanvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
        this.currentMousePos = {
            x: currentCanvasCoords.x,
            y: currentCanvasCoords.y
        };
        
        // 캔버스 좌표 기준으로 마우스 이동 거리 계산
        const deltaX = (this.currentMousePos.x - this.initialMousePos.x);
        const deltaY = (this.currentMousePos.y - this.initialMousePos.y);
        
        // 각 요소의 위치 조정
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const startPos = this.startPositions[i];
            
            // 시작 위치에 델타를 더해서 새로운 위치 계산
            let newX = startPos.x + deltaX;
            let newY = startPos.y + deltaY;
            
            // 무한 캔버스 모드가 아닐 때만 경계 체크
            if (!this.floorPlanManager.designModeManager || !this.floorPlanManager.designModeManager.autoExpandManager) {
                const canvasWidth = this.floorPlanManager.canvas.clientWidth;
                const canvasHeight = this.floorPlanManager.canvas.clientHeight;
                const elementWidth = parseFloat(element.style.width) || 0;
                const elementHeight = parseFloat(element.style.height) || 0;
                newX = Math.max(0, Math.min(newX, canvasWidth - elementWidth));
                newY = Math.max(0, Math.min(newY, canvasHeight - elementHeight));
            }
            
            // 위치 업데이트
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
            
            // 건물 또는 교실 요소인 경우 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                if (this.floorPlanManager && this.floorPlanManager.restoreBorderStyle) {
                    this.floorPlanManager.restoreBorderStyle(element);
                }
            }
        }
    }
    
    endGroupDrag() {
        if (this.isDragging) {
            // 드래그 종료 시 모든 요소의 테두리 스타일 복원
            for (const element of this.elements) {
                if (element.classList.contains('building') || element.classList.contains('room')) {
                    if (this.floorPlanManager && this.floorPlanManager.restoreBorderStyle) {
                        this.floorPlanManager.restoreBorderStyle(element);
                    }
                }
                
                // z-index 복원 (1초 후)
                setTimeout(() => {
                    if (element.dataset.originalZIndex) {
                        element.style.zIndex = element.dataset.originalZIndex;
                    } else {
                        element.style.zIndex = '';
                    }
                }, 1000);
            }
        }
        
        this.isDragging = false;
        this.elements = [];
        this.startPositions = [];
    }
    
    cancelGroupDrag() {
        if (!this.isDragging) return;
        
        // 원래 위치로 복원
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const startPos = this.startPositions[i];
            element.style.left = startPos.x + 'px';
            element.style.top = startPos.y + 'px';
            
            // 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                if (this.floorPlanManager && this.floorPlanManager.restoreBorderStyle) {
                    this.floorPlanManager.restoreBorderStyle(element);
                }
            }
        }
        
        this.endGroupDrag();
    }
} 