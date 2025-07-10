export default class SelectionBoxManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isBoxSelecting = false;
        this.selectionBox = null;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.justCompletedSelection = false;
        this.MIN_DRAG_DISTANCE = 3; // 최소 드래그 거리를 3픽셀로 줄임 (더 쉽게 박스 선택 시작)
        this.hasActuallyDragged = false; // 실제 드래그 발생 여부
    }

    startBoxSelection(e) {
        console.log('🎯 startBoxSelection 호출됨:', { currentTool: this.floorPlanManager.currentTool });
        
        if (this.floorPlanManager.currentTool !== 'select') {
            console.log('❌ select 도구가 아님, 박스 선택 중단');
            return false;
        }
        
        const canvas = document.getElementById('canvasContent');
        const coords = this.floorPlanManager.getCanvasCoordinates(e);
        
        this.startX = coords.x;
        this.startY = coords.y;
        this.currentX = this.startX;
        this.currentY = this.startY;
        this.isBoxSelecting = true;
        this.hasActuallyDragged = false; // 드래그 상태 초기화
        
        console.log('📦 박스 선택 준비:', { startX: this.startX, startY: this.startY });
        
        // 선택 박스 요소는 실제 드래그가 발생했을 때 생성
        this.selectionBox = null;
        
        console.log('✅ 박스 선택 준비 완료');
        return true;
    }

    updateBoxSelection(e) {
        if (!this.isBoxSelecting) return;
        
        const coords = this.floorPlanManager.getCanvasCoordinates(e);
        this.currentX = coords.x;
        this.currentY = coords.y;
        
        // 시작점에서 현재 위치까지의 거리 계산
        const deltaX = Math.abs(this.currentX - this.startX);
        const deltaY = Math.abs(this.currentY - this.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 최소 드래그 거리 이상 움직였을 때만 실제 드래그로 인정
        if (!this.hasActuallyDragged && distance >= this.MIN_DRAG_DISTANCE) {
            this.hasActuallyDragged = true;
            this.createSelectionBox();
            console.log('📦 실제 드래그 시작! 박스 생성됨');
        }
        
        // 실제 드래그가 발생한 경우에만 박스 업데이트
        if (this.hasActuallyDragged && this.selectionBox) {
            const left = Math.min(this.startX, this.currentX);
            const top = Math.min(this.startY, this.currentY);
            const width = Math.abs(this.currentX - this.startX);
            const height = Math.abs(this.currentY - this.startY);
            
            this.selectionBox.style.left = left + 'px';
            this.selectionBox.style.top = top + 'px';
            this.selectionBox.style.width = width + 'px';
            this.selectionBox.style.height = height + 'px';
            
            // 큰 드래그만 로그 (너무 많은 로그 방지)
            if (width > 10 || height > 10) {
                console.log('📦 박스 업데이트:', { left, top, width, height });
            }
        }
    }
    
    createSelectionBox() {
        const canvas = document.getElementById('canvasContent');
        
        // 선택 박스 요소 생성
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.selectionBox.style.position = 'absolute';
        this.selectionBox.style.border = '4px dashed #3b82f6'; // 더 두꺼운 테두리
        this.selectionBox.style.background = 'rgba(59, 130, 246, 0.2)'; // 더 진한 배경
        this.selectionBox.style.pointerEvents = 'none';
        this.selectionBox.style.zIndex = '999999';
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        this.selectionBox.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8)'; // 더 강한 그림자
        this.selectionBox.style.animation = 'selectionPulse 0.8s ease-in-out infinite alternate'; // 펄스 애니메이션
        this.selectionBox.id = 'selection-box-debug';
        
        // 애니메이션 CSS 추가 (한 번만)
        if (!document.getElementById('selection-animation-style')) {
            const style = document.createElement('style');
            style.id = 'selection-animation-style';
            style.textContent = `
                @keyframes selectionPulse {
                    from { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
                    to { border-color: #1d4ed8; box-shadow: 0 0 25px rgba(29, 78, 216, 1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        canvas.appendChild(this.selectionBox);
        console.log('✅ 강화된 선택 박스 요소 생성 및 추가 완료');
    }

    endBoxSelection(e) {
        console.log('🏁 endBoxSelection 호출됨:', { 
            isBoxSelecting: this.isBoxSelecting, 
            hasActuallyDragged: this.hasActuallyDragged 
        });
        
        if (!this.isBoxSelecting) {
            console.log('❌ 박스 선택 중이 아님');
            return [];
        }
        
        // 실제 드래그가 발생하지 않았으면 선택 처리하지 않음
        if (!this.hasActuallyDragged) {
            console.log('📦 실제 드래그 없음 - 클릭으로 처리됨');
            this.isBoxSelecting = false;
            this.justCompletedSelection = false; // 클릭이므로 플래그 설정 안 함
            return [];
        }
        
        const left = Math.min(this.startX, this.currentX);
        const top = Math.min(this.startY, this.currentY);
        const right = Math.max(this.startX, this.currentX);
        const bottom = Math.max(this.startY, this.currentY);
        
        console.log('📦 박스 선택 영역:', { left, top, right, bottom });
        
        // 선택 박스 내의 요소들 찾기
        const elements = document.querySelectorAll('.building, .room');
        const selectedElements = [];
        
        console.log('🔍 검사할 요소 수:', elements.length);
        
        elements.forEach(element => {
            const rect = {
                left: parseInt(element.style.left) || 0,
                top: parseInt(element.style.top) || 0,
                right: (parseInt(element.style.left) || 0) + (parseInt(element.style.width) || 100),
                bottom: (parseInt(element.style.top) || 0) + (parseInt(element.style.height) || 80)
            };
            
            // 요소가 선택 박스와 겹치는지 확인
            if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
                selectedElements.push(element);
                console.log('✅ 선택된 요소:', element.dataset.type, element.textContent?.trim());
            }
        });
        
        console.log('📦 총 선택된 요소 수:', selectedElements.length);
        
        // 선택 박스 제거
        if (this.selectionBox && this.selectionBox.parentNode) {
            this.selectionBox.parentNode.removeChild(this.selectionBox);
            console.log('🗑️ 선택 박스 제거됨');
        }
        this.selectionBox = null;
        this.isBoxSelecting = false;
        
        this.justCompletedSelection = true;
        
        return selectedElements;
    }

    cancelBoxSelection() {
        if (this.selectionBox && this.selectionBox.parentNode) {
            this.selectionBox.parentNode.removeChild(this.selectionBox);
        }
        this.selectionBox = null;
        this.isBoxSelecting = false;
    }
} 