export default class ResizeManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isResizing = false;
        this.selectedElement = null;
        this.resizeHandle = null;
        this.startPos = { x: 0, y: 0 };
        this.startSize = { width: 0, height: 0 };
        this.startElementPos = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.minSize = { width: 60, height: 40 }; // 최소 크기 (20% 증가)
    }

    addResizeHandles(element) {
        // 기존 핸들 제거
        this.removeResizeHandles(element);
        
        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'resize-handles';
        
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        
        handles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction}`;
            handle.dataset.direction = direction;
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, element, direction);
            });
            
            handlesContainer.appendChild(handle);
        });
        
        element.appendChild(handlesContainer);
        
        // 마우스 이벤트 바인딩
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    removeResizeHandles(element) {
        const existingHandles = element.querySelector('.resize-handles');
        if (existingHandles) {
            existingHandles.remove();
        }
    }

    startResize(e, element, direction) {
        e.preventDefault();
        this.isResizing = true;
        this.resizeHandle = direction;
        this.selectedElement = element;
        // zoomLevel 및 캔버스 기준 좌표계로 변환
        const zoomLevel = this.floorPlanManager.zoomManager.getCurrentZoom ? this.floorPlanManager.zoomManager.getCurrentZoom() : 1;
        const canvas = document.getElementById('canvasContent');
        const canvasRect = canvas.getBoundingClientRect();
        this.startPos = {
            x: (e.clientX - canvasRect.left) / zoomLevel,
            y: (e.clientY - canvasRect.top) / zoomLevel
        };
        this.startElementPos = {
            x: parseFloat(element.style.left),
            y: parseFloat(element.style.top),
            width: parseFloat(element.style.width),
            height: parseFloat(element.style.height)
        };
        document.body.style.cursor = getComputedStyle(e.target).cursor;
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;
        const zoomLevel = this.floorPlanManager.zoomManager.getCurrentZoom ? this.floorPlanManager.zoomManager.getCurrentZoom() : 1;
        const canvas = document.getElementById('canvasContent');
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - canvasRect.left) / zoomLevel;
        const mouseY = (e.clientY - canvasRect.top) / zoomLevel;
        const deltaX = mouseX - this.startPos.x;
        const deltaY = mouseY - this.startPos.y;
        let newRect = { ...this.startElementPos };
        let applySnap = false;
        switch (this.resizeHandle) {
            case 'nw':
                newRect.x += deltaX;
                newRect.y += deltaY;
                newRect.width -= deltaX;
                newRect.height -= deltaY;
                applySnap = true;
                break;
            case 'ne':
                newRect.y += deltaY;
                newRect.width += deltaX;
                newRect.height -= deltaY;
                applySnap = true;
                break;
            case 'sw':
                newRect.x += deltaX;
                newRect.width -= deltaX;
                newRect.height += deltaY;
                applySnap = true;
                break;
            case 'se':
                newRect.width += deltaX;
                newRect.height += deltaY;
                break;
            case 'n':
                newRect.y += deltaY;
                newRect.height -= deltaY;
                applySnap = true;
                break;
            case 's':
                newRect.height += deltaY;
                break;
            case 'w':
                newRect.x += deltaX;
                newRect.width -= deltaX;
                applySnap = true;
                break;
            case 'e':
                newRect.width += deltaX;
                break;
        }
        // 최소 크기 제한
        if (newRect.width < this.minSize.width) {
            if (this.resizeHandle.includes('w')) {
                newRect.x = this.startElementPos.x + this.startElementPos.width - this.minSize.width;
            }
            newRect.width = this.minSize.width;
        }
        if (newRect.height < this.minSize.height) {
            if (this.resizeHandle.includes('n')) {
                newRect.y = this.startElementPos.y + this.startElementPos.height - this.minSize.height;
            }
            newRect.height = this.minSize.height;
        }
        // 경계 제한 (캔버스 밖으로 못 나가게)
        newRect.x = Math.max(0, Math.min(newRect.x, canvasWidth - newRect.width));
        newRect.y = Math.max(0, Math.min(newRect.y, canvasHeight - newRect.height));
        newRect.width = Math.min(newRect.width, canvasWidth - newRect.x);
        newRect.height = Math.min(newRect.height, canvasHeight - newRect.y);
        let snappedPosition = { x: newRect.x, y: newRect.y };
        if (applySnap) {
            snappedPosition = this.floorPlanManager.snapManager.snapElement(
                this.selectedElement, 
                newRect.x, 
                newRect.y
            );
        }
        this.selectedElement.style.left = snappedPosition.x + 'px';
        this.selectedElement.style.top = snappedPosition.y + 'px';
        this.selectedElement.style.width = newRect.width + 'px';
        this.selectedElement.style.height = newRect.height + 'px';
    }

    handleMouseUp(e) {
        if (!this.isResizing) return;
        
        // 스냅 피드백 제거
        if (this.selectedElement) {
            this.floorPlanManager.snapManager.hideSnapFeedback(this.selectedElement);
        }
        
        // 교실인 경우 장비정보 다시 계산
        if (this.selectedElement && this.selectedElement.classList.contains('room')) {
            const roomId = this.selectedElement.dataset.id;
            if (roomId) {
                // 장비정보 다시 로드 및 표시
                this.floorPlanManager.loadAndDisplayDeviceIcons(roomId, this.selectedElement);
            }
        }
        
        this.isResizing = false;
        this.resizeHandle = null;
        this.selectedElement = null;
        
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 크기 조절 완료 후 선택 상태 해제하여 빨간색 테두리 제거
        this.floorPlanManager.clearSelection();
        
        // 크기 변경 완료 이벤트 발생
        const resizeCompleteEvent = new CustomEvent('resizeComplete', {
            detail: { element: this.selectedElement }
        });
        document.dispatchEvent(resizeCompleteEvent);
    }
} 