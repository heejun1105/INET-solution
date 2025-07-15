export default class DragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.dragElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.zIndexTimeout = null; // z-index 타이머 추가
        this.dragStartTime = 0; // 드래그 시작 시간 추가
        this.startPosition = { x: 0, y: 0 }; // 시작 위치 추가
        this.initialMousePos = { x: 0, y: 0 }; // 초기 마우스 위치 추가
    }

    startDrag(element, e) {
        if (this.isDragging) return;
        if (!this.isValidDraggable(element)) return;
        
        this.isDragging = true;
        this.dragElement = element;
        this.dragStartTime = Date.now(); // 드래그 시작 시간 기록
        
        // 요소의 현재 위치 저장
        this.startPosition = {
            x: parseInt(element.style.left) || 0,
            y: parseInt(element.style.top) || 0
        };
        
        // 초기 마우스 위치 저장
        this.initialMousePos = {
            x: e.clientX,
            y: e.clientY
        };

        // 교실 요소인 경우 z-index 높게 설정
        if (element.classList.contains('room')) {
            element.dataset.originalZIndex = element.style.zIndex || '';
            element.style.zIndex = '1000'; // 높은 z-index 값
        }
        
        // 도형 요소인 경우에도 z-index 높게 설정
        if (element.classList.contains('shape')) {
            element.dataset.originalZIndex = element.style.zIndex || '';
            element.style.zIndex = '1000'; // 높은 z-index 값
        }

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

        // 현재 마우스 위치
        const currentMousePos = {
            x: e.clientX,
            y: e.clientY
        };
        
        // 마우스 이동 거리 계산
        const deltaX = currentMousePos.x - this.initialMousePos.x;
        const deltaY = currentMousePos.y - this.initialMousePos.y;
        
        // 줌 레벨 고려 - GroupDragManager와 동일한 방식으로 계산
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
        
        // 줌 레벨을 고려한 위치 조정
        let newX = this.startPosition.x + (deltaX / zoomLevel);
        let newY = this.startPosition.y + (deltaY / zoomLevel);
        
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
        
        // 드래그 중에도 테두리 스타일 유지
        if (this.dragElement.classList.contains('building') || this.dragElement.classList.contains('room')) {
            this.floorPlanManager.restoreBorderStyle(this.dragElement);
        }
    }
    
    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        // 드래그 종료 시간과 시작 시간의 차이 계산 (밀리초)
        const dragDuration = Date.now() - this.dragStartTime;
        
        if (this.dragElement) {
            this.floorPlanManager.snapManager.hideSnapFeedback(this.dragElement);
            
            // 드래그 완료 후 테두리 스타일 복원
            this.floorPlanManager.restoreBorderStyle(this.dragElement);
            
            // 교실 요소인 경우 z-index를 일정 시간 후에 원래대로 복원
            if (this.dragElement.classList.contains('room') || this.dragElement.classList.contains('shape')) {
                // 이전 타이머가 있으면 제거
                if (this.zIndexTimeout) {
                    clearTimeout(this.zIndexTimeout);
                }
                
                // 1초 후에 z-index 복원
                this.zIndexTimeout = setTimeout(() => {
                    if (this.dragElement) {
                        if (this.dragElement.dataset.originalZIndex) {
                            this.dragElement.style.zIndex = this.dragElement.dataset.originalZIndex;
                        } else {
                            this.dragElement.style.zIndex = '';
                        }
                    }
                }, 1000);
            }
            
            // 드래그가 짧은 시간 내에 끝났고 실제로 이동이 거의 없었다면 클릭으로 처리
            if (dragDuration < 200) {
                // 클릭 이벤트를 시뮬레이션하지 않음 - 충돌 방지
                console.log('짧은 드래그 감지 - 클릭으로 처리하지 않음');
            }
        }

        // 드래그 상태 초기화
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.dragElement = null;
        this.dragStartTime = 0;
        
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
        
        return wasDragging; // 드래그 상태였는지 반환
    }
} 