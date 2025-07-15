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
        
        // 초기 마우스 위치 저장
        this.initialMousePos = { 
            x: e.clientX,
            y: e.clientY
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
        
        // 현재 마우스 위치 업데이트
        this.currentMousePos = {
            x: e.clientX,
            y: e.clientY
        };
        
        // 마우스 이동 거리 계산
        const deltaX = (this.currentMousePos.x - this.initialMousePos.x);
        const deltaY = (this.currentMousePos.y - this.initialMousePos.y);
        
        // 줌 레벨 고려
        let zoomLevel = 1;
        try {
            const canvas = document.getElementById('canvasContent');
            const transform = canvas.style.transform;
            if (transform) {
                const match = transform.match(/scale\(([0-9.]+)\)/);
                if (match && match[1]) {
                    zoomLevel = parseFloat(match[1]);
                }
            }
        } catch (e) {
            console.error('줌 레벨 가져오기 실패', e);
        }
        
        // 캔버스 크기 가져오기
        const canvasWidth = this.floorPlanManager.canvas.clientWidth;
        const canvasHeight = this.floorPlanManager.canvas.clientHeight;
        
        // 각 요소의 위치 조정
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const startPos = this.startPositions[i];
            
            // 줌 레벨을 고려한 위치 조정
            let newX = startPos.x + (deltaX / zoomLevel);
            let newY = startPos.y + (deltaY / zoomLevel);
            
            // 경계 체크
            const elementWidth = parseFloat(element.style.width) || 0;
            const elementHeight = parseFloat(element.style.height) || 0;
            newX = Math.max(0, Math.min(newX, canvasWidth - elementWidth));
            newY = Math.max(0, Math.min(newY, canvasHeight - elementHeight));
            
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