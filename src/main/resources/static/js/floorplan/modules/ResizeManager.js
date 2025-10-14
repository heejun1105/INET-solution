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
        this.minSize = { width:1, height: 1 }; // 최소 크기 (선 종류는 높이 제한 없음)
    }

    addResizeHandles(element) {
        // 기존 핸들 제거
        this.removeResizeHandles(element);
        
        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'resize-handles';
        
        // 선 종류인지 확인
        const isLineType = element.classList.contains('shape') && 
                          (element.dataset.shapetype === 'line' || 
                           element.dataset.shapetype === 'arrow' || 
                           element.dataset.shapetype === 'dashed');
        
        let handles;
        if (isLineType) {
            // 선 종류는 가로 방향만 조절 가능
            handles = ['w', 'e'];
        } else {
            // 다른 도형들은 8방향 모두 조절 가능
            handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        }
        
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
        
        // 선 종류인지 확인
        const isLineType = element.classList.contains('shape') && 
                          (element.dataset.shapetype === 'line' || 
                           element.dataset.shapetype === 'arrow' || 
                           element.dataset.shapetype === 'dashed');
        
        // FloorPlanManager의 좌표 변환 메서드 사용 (줌과 팬을 고려)
        const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
        this.startPos = {
            x: canvasCoords.x,
            y: canvasCoords.y
        };
        
        // 선 종류의 경우 원본 높이(굵기)를 저장
        if (isLineType) {
            const originalThickness = parseInt(element.dataset.thickness) || 2;
            this.startElementPos = {
                x: parseFloat(element.style.left),
                y: parseFloat(element.style.top),
                width: parseFloat(element.style.width),
                height: originalThickness // 원본 굵기 사용
            };
        } else {
            this.startElementPos = {
                x: parseFloat(element.style.left),
                y: parseFloat(element.style.top),
                width: parseFloat(element.style.width),
                height: parseFloat(element.style.height)
            };
        }
        
        document.body.style.cursor = getComputedStyle(e.target).cursor;
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;
        
        // FloorPlanManager의 좌표 변환 메서드 사용 (줌과 팬을 고려)
        const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
        const mouseX = canvasCoords.x;
        const mouseY = canvasCoords.y;
        const deltaX = mouseX - this.startPos.x;
        const deltaY = mouseY - this.startPos.y;
        let newRect = { ...this.startElementPos };
        let applySnap = false;
        
        // 선 종류인지 확인
        const isLineType = this.selectedElement.classList.contains('shape') && 
                          (this.selectedElement.dataset.shapetype === 'line' || 
                           this.selectedElement.dataset.shapetype === 'arrow' || 
                           this.selectedElement.dataset.shapetype === 'dashed');
        
        if (isLineType) {
            // 선 종류는 가로 방향만 조절
            switch (this.resizeHandle) {
                case 'w':
                    newRect.x += deltaX;
                    newRect.width -= deltaX;
                    applySnap = true;
                    break;
                case 'e':
                    newRect.width += deltaX;
                    break;
            }
        } else {
            // 일반 도형은 8방향 모두 조절 가능
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
        }
        
        // 최소 크기 제한
        if (newRect.width < this.minSize.width) {
            if (this.resizeHandle.includes('w')) {
                newRect.x = this.startElementPos.x + this.startElementPos.width - this.minSize.width;
            }
            newRect.width = this.minSize.width;
        }
        
        // 선 종류가 아닌 경우에만 높이에 대한 최소 크기 제한 적용
        if (!isLineType && newRect.height < this.minSize.height) {
            if (this.resizeHandle.includes('n')) {
                newRect.y = this.startElementPos.y + this.startElementPos.height - this.minSize.height;
            }
            newRect.height = this.minSize.height;
        }
        
        // 선 종류의 경우 높이를 원본 굵기로 강제 유지하고 Y 좌표 고정
        if (isLineType) {
            const originalThickness = parseInt(this.selectedElement.dataset.thickness) || 2;
            newRect.height = originalThickness; // 원본 굵기로 강제 설정
            newRect.y = this.startElementPos.y; // Y 좌표 고정
        }
        // 경계 제한 (캔버스 밖으로 못 나가게)
        newRect.x = Math.max(0, Math.min(newRect.x, canvasWidth - newRect.width));
        newRect.width = Math.min(newRect.width, canvasWidth - newRect.x);
        
        if (isLineType) {
            // 선 종류는 높이에 대한 경계 제한을 적용하지 않음
            newRect.y = this.startElementPos.y;
            newRect.height = parseInt(this.selectedElement.dataset.thickness) || 2;
        } else {
            newRect.y = Math.max(0, Math.min(newRect.y, canvasHeight - newRect.height));
            newRect.height = Math.min(newRect.height, canvasHeight - newRect.y);
        }
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
        
        if (isLineType) {
            // 선 종류는 높이(굵기)를 변경하지 않음
            // 원본 굵기로 강제 설정
            const originalThickness = parseInt(this.selectedElement.dataset.thickness) || 2;
            this.selectedElement.style.setProperty('height', originalThickness + 'px', 'important');
            this.selectedElement.style.setProperty('--original-thickness', originalThickness + 'px', 'important');
            this.maintainShapeStyle(this.selectedElement);
        } else {
            // 다른 도형들은 높이도 변경
            this.selectedElement.style.height = newRect.height + 'px';
            
            // 도형인 경우 원본 굵기와 색상 유지
            if (this.selectedElement.classList.contains('shape')) {
                this.maintainShapeStyle(this.selectedElement);
            }
        }
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
        
        // 도형인 경우 리사이즈 완료 후 스타일을 다시 한 번 강제 적용
        if (this.selectedElement && this.selectedElement.classList.contains('shape')) {
            // 약간의 지연을 두고 스타일 재적용 (CSS 애니메이션 완료 후)
            setTimeout(() => {
                this.maintainShapeStyle(this.selectedElement);
            }, 10);
        }
        
        // 크기 조절 완료 후 선택 상태 해제하여 빨간색 테두리 제거
        this.floorPlanManager.clearSelection();
        
        // 크기 변경 완료 이벤트 발생
        const resizeCompleteEvent = new CustomEvent('resizeComplete', {
            detail: { element: this.selectedElement }
        });
        document.dispatchEvent(resizeCompleteEvent);
    }
    
    maintainShapeStyle(element) {
        const shapeType = element.dataset.shapetype;
        const thickness = parseInt(element.dataset.thickness) || 2;
        const color = element.dataset.color || '#000000';
        
        console.log('도형 스타일 유지:', { shapeType, thickness, color });
        
        if (shapeType === 'line' || shapeType === 'arrow' || shapeType === 'dashed') {
            // 선 타입 도형의 경우 높이를 굵기로 강제 유지
            element.style.setProperty('height', thickness + 'px', 'important');
            element.style.setProperty('background-color', color, 'important');
            element.style.setProperty('--original-thickness', thickness + 'px', 'important');
            
            if (shapeType === 'dashed') {
                // 점선 패턴 재적용
                const dashSize = 5;
                const gapSize = 5;
                element.style.setProperty('background', `repeating-linear-gradient(to right, ${color}, ${color} ${dashSize}px, transparent ${dashSize}px, transparent ${dashSize + gapSize}px)`, 'important');
            } else if (shapeType === 'arrow') {
                // 화살표 헤드 재적용
                element.style.setProperty('background-color', color, 'important');
                const arrowHead = element.querySelector('.arrow-head');
                if (arrowHead) {
                    const arrowSize = Math.max(thickness * 3, 8);
                    arrowHead.style.borderTop = `${arrowSize/2}px solid transparent`;
                    arrowHead.style.borderBottom = `${arrowSize/2}px solid transparent`;
                    arrowHead.style.borderLeft = `${arrowSize}px solid ${color}`;
                    arrowHead.style.marginRight = `-${arrowSize}px`;
                }
            }
        } else if (shapeType === 'rect' || shapeType === 'circle' || shapeType === 'arc') {
            // 테두리 도형의 경우 테두리 굵기와 색상 유지
            element.style.borderWidth = thickness + 'px';
            element.style.borderColor = color;
            element.style.borderStyle = 'solid';
            
            // arc의 경우 특별한 테두리 설정 유지
            if (shapeType === 'arc') {
                element.style.borderBottomColor = 'transparent';
                element.style.borderLeftColor = 'transparent';
            }
        } else if (shapeType === 'curve') {
            // 곡선의 경우 SVG 내부의 stroke-width 유지
            const svg = element.querySelector('svg');
            if (svg) {
                const path = svg.querySelector('path');
                if (path) {
                    path.setAttribute('stroke-width', thickness.toString());
                    path.setAttribute('stroke', color);
                }
            }
        }
        
        // !important를 사용하여 스타일 우선순위 높임
        if (shapeType === 'line' || shapeType === 'arrow' || shapeType === 'dashed') {
            element.style.setProperty('height', thickness + 'px', 'important');
            element.style.setProperty('background-color', color, 'important');
        } else if (shapeType === 'rect' || shapeType === 'circle' || shapeType === 'arc') {
            element.style.setProperty('border-width', thickness + 'px', 'important');
            element.style.setProperty('border-color', color, 'important');
            element.style.setProperty('border-style', 'solid', 'important');
        }
    }
} 