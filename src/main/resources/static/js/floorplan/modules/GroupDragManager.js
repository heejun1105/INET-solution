export default class GroupDragManager {
    constructor() {
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
        
        // 각 요소의 위치 조정
        for (let i = 0; i < this.elements.length; i++) {
            const element = this.elements[i];
            const startPos = this.startPositions[i];
            
            // 도형 요소인 경우 특별 처리 추가
            const isShape = element.classList.contains('shape');
            
            // 줌 레벨을 고려한 위치 조정
            const newX = startPos.x + (deltaX / zoomLevel);
            const newY = startPos.y + (deltaY / zoomLevel);
            
            // 위치 업데이트
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        }
    }
    
    endGroupDrag() {
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
        }
        
        this.endGroupDrag();
    }
} 