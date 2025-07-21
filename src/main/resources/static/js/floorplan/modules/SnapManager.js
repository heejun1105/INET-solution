export default class SnapManager {
    constructor() {
        this.snapDistance = 15; // 스냅 거리 (픽셀)
    }

    /**
     * 요소를 다른 요소들에 스냅시킵니다
     */
    snapElement(element, targetX, targetY) {
        const elementType = element.dataset.type;
        const allElements = document.querySelectorAll('.building, .room');
        const otherElements = Array.from(allElements).filter(el => el !== element);
        
        if (otherElements.length === 0) {
            return { x: targetX, y: targetY };
        }

        const elementRect = {
            x: targetX,
            y: targetY,
            width: parseInt(element.style.width) || 100,
            height: parseInt(element.style.height) || 80,
            get right() { return this.x + this.width; },
            get bottom() { return this.y + this.height; }
        };

        let snappedX = targetX;
        let snappedY = targetY;
        let hasSnapped = false;

        // 다른 요소들과 스냅 체크
        for (const otherElement of otherElements) {
            const otherRect = this.getElementRect(otherElement);
            
            // 수평 스냅 체크
            const snapResult = this.checkSnap(elementRect, otherRect);
            if (snapResult.snapped) {
                if (snapResult.x !== null) {
                    snappedX = snapResult.x;
                    hasSnapped = true;
                }
                if (snapResult.y !== null) {
                    snappedY = snapResult.y;
                    hasSnapped = true;
                }
            }
        }

        // 스냅된 경우 시각적 피드백
        if (hasSnapped) {
            this.showSnapFeedback(element);
        } else {
            this.hideSnapFeedback(element);
        }

        return { x: snappedX, y: snappedY };
    }

    /**
     * 두 사각형 간의 스냅 가능성 체크
     */
    checkSnap(rect1, rect2) {
        let snappedX = null;
        let snappedY = null;
        let snapped = false;

        // 수직 정렬 여부 확인 (Y축 겹침)
        const verticalOverlap = !(rect1.bottom < rect2.y || rect1.y > rect2.bottom);
        
        // 수평 정렬 여부 확인 (X축 겹침)
        const horizontalOverlap = !(rect1.right < rect2.x || rect1.x > rect2.right);

        if (verticalOverlap) {
            // 좌측 경계 스냅: rect1의 오른쪽이 rect2의 왼쪽에
            if (Math.abs(rect1.right - rect2.x) <= this.snapDistance) {
                snappedX = rect2.x - rect1.width;
                snapped = true;
            }
            // 우측 경계 스냅: rect1의 왼쪽이 rect2의 오른쪽에
            else if (Math.abs(rect1.x - rect2.right) <= this.snapDistance) {
                snappedX = rect2.right;
                snapped = true;
            }
            // 중앙 정렬 스냅
            else if (Math.abs(rect1.x - rect2.x) <= this.snapDistance) {
                snappedX = rect2.x;
                snapped = true;
            }
            else if (Math.abs(rect1.right - rect2.right) <= this.snapDistance) {
                snappedX = rect2.right - rect1.width;
                snapped = true;
            }
        }

        if (horizontalOverlap) {
            // 상단 경계 스냅: rect1의 하단이 rect2의 상단에
            if (Math.abs(rect1.bottom - rect2.y) <= this.snapDistance) {
                snappedY = rect2.y - rect1.height;
                snapped = true;
            }
            // 하단 경계 스냅: rect1의 상단이 rect2의 하단에
            else if (Math.abs(rect1.y - rect2.bottom) <= this.snapDistance) {
                snappedY = rect2.bottom;
                snapped = true;
            }
            // 중앙 정렬 스냅
            else if (Math.abs(rect1.y - rect2.y) <= this.snapDistance) {
                snappedY = rect2.y;
                snapped = true;
            }
            else if (Math.abs(rect1.bottom - rect2.bottom) <= this.snapDistance) {
                snappedY = rect2.bottom - rect1.height;
                snapped = true;
            }
        }

        return { snapped, x: snappedX, y: snappedY };
    }

    /**
     * 요소의 위치와 크기 정보 반환
     */
    getElementRect(element) {
        const style = element.style;
        return {
            x: parseInt(style.left) || 0,
            y: parseInt(style.top) || 0,
            width: parseInt(style.width) || 120,
            height: parseInt(style.height) || 96,
            get right() { return this.x + this.width; },
            get bottom() { return this.y + this.height; }
        };
    }

    /**
     * 스냅 시각적 피드백 표시
     */
    showSnapFeedback(element) {
        element.style.boxShadow = '0 0 10px #007bff';
        element.style.borderColor = '#007bff';
    }

    /**
     * 스냅 시각적 피드백 숨기기
     */
    hideSnapFeedback(element) {
        element.style.boxShadow = '';
        element.style.borderColor = '';
    }

    /**
     * 그리드에 스냅
     */
    snapToGrid(x, y, gridSize = 10) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
} 