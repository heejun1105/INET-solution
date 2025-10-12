/**
 * 자동 확장 관리자
 * 요소가 경계를 넘으면 캔버스를 자동으로 확장
 */
export default class AutoExpandManager {
    constructor(infiniteCanvasManager) {
        this.infiniteCanvasManager = infiniteCanvasManager;
        
        // 확장/축소 설정
        this.padding = 300; // 확장 시 추가할 여백
        this.expandMargin = 50; // 경계로부터 50px 내에 들어오면 확장
        this.minCanvasWidth = 800; // 최소 캔버스 너비
        this.minCanvasHeight = 600; // 최소 캔버스 높이
        
        // 확장 중 플래그
        this.isProcessing = false;
    }
    
    /**
     * 요소의 경계 체크 및 필요 시 확장/축소
     */
    checkAndExpand(element) {
        if (!element || this.isProcessing) return;
        
        const bounds = this.getElementBounds(element);
        if (!bounds) {
            console.warn('⚠️ AutoExpand: 요소 경계를 가져올 수 없습니다.');
            return;
        }
        
        // 확장이 필요한지 체크
        const expansion = this.needsExpansion(bounds);
        if (expansion.expandLeft || expansion.expandRight || expansion.expandTop || expansion.expandBottom) {
            console.log('📐 확장 필요:', expansion);
            this.expandCanvas(bounds);
        }
    }
    
    /**
     * 모든 요소를 기반으로 캔버스 최적화 (확장/축소)
     */
    optimizeCanvas() {
        if (this.isProcessing) return;
        
        const canvas = this.infiniteCanvasManager.canvas;
        if (!canvas) return;
        
        // 캔버스 내의 모든 floor-element 요소 찾기
        const allElements = canvas.querySelectorAll('.floor-element');
        if (allElements.length === 0) {
            // 요소가 없으면 최소 크기로 축소
            this.resetToMinimumSize();
            return;
        }
        
        // 모든 요소를 포함하는 최소 경계 계산
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        allElements.forEach(element => {
            const bounds = this.getElementBounds(element);
            if (bounds) {
                minX = Math.min(minX, bounds.minX);
                minY = Math.min(minY, bounds.minY);
                maxX = Math.max(maxX, bounds.maxX);
                maxY = Math.max(maxY, bounds.maxY);
            }
        });
        
        if (minX === Infinity) {
            this.resetToMinimumSize();
            return;
        }
        
        // 여백 추가
        const requiredBounds = {
            minX: Math.min(minX - this.padding, 0), // 최소 0
            minY: Math.min(minY - this.padding, 0),
            maxX: Math.max(maxX + this.padding, this.minCanvasWidth),
            maxY: Math.max(maxY + this.padding, this.minCanvasHeight)
        };
        
        const currentBounds = this.infiniteCanvasManager.bounds;
        
        // 현재 캔버스와 필요한 크기 비교
        const needsUpdate = 
            requiredBounds.minX !== currentBounds.minX ||
            requiredBounds.minY !== currentBounds.minY ||
            requiredBounds.maxX !== currentBounds.maxX ||
            requiredBounds.maxY !== currentBounds.maxY;
        
        if (needsUpdate) {
            console.log('🔄 캔버스 최적화:', {
                이전: currentBounds,
                필요: requiredBounds
            });
            this.infiniteCanvasManager.updateBounds(requiredBounds);
        }
    }
    
    /**
     * 요소의 경계 가져오기
     */
    getElementBounds(element) {
        try {
            // 요소의 style에서 직접 좌표 읽기 (캔버스 좌표)
            const left = parseFloat(element.style.left) || 0;
            const top = parseFloat(element.style.top) || 0;
            const width = parseFloat(element.style.width) || 100;
            const height = parseFloat(element.style.height) || 100;
            
            return {
                minX: left,
                minY: top,
                maxX: left + width,
                maxY: top + height
            };
        } catch (error) {
            console.error('Error getting element bounds:', error);
            return null;
        }
    }
    
    /**
     * 확장이 필요한지 체크 - 요소가 캔버스 경계를 넘어가는지
     */
    needsExpansion(bounds) {
        const currentBounds = this.infiniteCanvasManager.bounds;
        const margin = this.expandMargin;
        
        // 요소가 캔버스 경계에서 margin 이내에 있거나 넘어갔는지 체크
        const expandLeft = bounds.minX < (currentBounds.minX + margin);
        const expandRight = bounds.maxX > (currentBounds.maxX - margin);
        const expandTop = bounds.minY < (currentBounds.minY + margin);
        const expandBottom = bounds.maxY > (currentBounds.maxY - margin);
        
        if (expandLeft || expandRight || expandTop || expandBottom) {
            console.log('🔍 확장 경계 체크:', {
                expandLeft, expandRight, expandTop, expandBottom,
                element: `(${bounds.minX}, ${bounds.minY}) - (${bounds.maxX}, ${bounds.maxY})`,
                canvas: `(${currentBounds.minX}, ${currentBounds.minY}) - (${currentBounds.maxX}, ${currentBounds.maxY})`
            });
        }
        
        return { expandLeft, expandRight, expandTop, expandBottom };
    }
    
    /**
     * 최소 크기로 리셋
     */
    resetToMinimumSize() {
        const newBounds = {
            minX: 0,
            minY: 0,
            maxX: this.minCanvasWidth,
            maxY: this.minCanvasHeight
        };
        
        console.log('🔄 캔버스 최소 크기로 리셋:', newBounds);
        this.infiniteCanvasManager.updateBounds(newBounds);
    }
    
    /**
     * 캔버스 확장
     */
    expandCanvas(elementBounds) {
        this.isProcessing = true;
        
        const currentBounds = this.infiniteCanvasManager.bounds;
        const expansionNeeded = this.needsExpansion(elementBounds);
        
        // 새로운 경계 계산
        const newBounds = { ...currentBounds };
        let expanded = false;
        let direction = [];
        
        // 왼쪽으로 확장
        if (expansionNeeded.expandLeft) {
            newBounds.minX = Math.min(0, elementBounds.minX - this.padding);
            expanded = true;
            direction.push('왼쪽');
        }
        
        // 오른쪽으로 확장
        if (expansionNeeded.expandRight) {
            newBounds.maxX = Math.max(elementBounds.maxX + this.padding, currentBounds.maxX);
            expanded = true;
            direction.push('오른쪽');
        }
        
        // 위쪽으로 확장
        if (expansionNeeded.expandTop) {
            newBounds.minY = Math.min(0, elementBounds.minY - this.padding);
            expanded = true;
            direction.push('위쪽');
        }
        
        // 아래쪽으로 확장
        if (expansionNeeded.expandBottom) {
            newBounds.maxY = Math.max(elementBounds.maxY + this.padding, currentBounds.maxY);
            expanded = true;
            direction.push('아래쪽');
        }
        
        if (expanded) {
            console.log(`✨ 캔버스 ${direction.join(', ')}으로 확장!`, {
                이전: `${currentBounds.maxX - currentBounds.minX}×${currentBounds.maxY - currentBounds.minY}`,
                현재: `${newBounds.maxX - newBounds.minX}×${newBounds.maxY - newBounds.minY}`,
                경계: newBounds
            });
            
            // 경계 업데이트
            this.infiniteCanvasManager.updateBounds(newBounds);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * 여러 요소에 대해 경계 체크
     */
    checkMultipleElements(elements) {
        if (!elements || elements.length === 0) return;
        
        // 모든 요소의 경계 합산
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        elements.forEach(element => {
            const bounds = this.getElementBounds(element);
            if (bounds) {
                minX = Math.min(minX, bounds.minX);
                minY = Math.min(minY, bounds.minY);
                maxX = Math.max(maxX, bounds.maxX);
                maxY = Math.max(maxY, bounds.maxY);
            }
        });
        
        if (minX !== Infinity) {
            const combinedBounds = { minX, minY, maxX, maxY };
            const needsExpansion = this.checkBounds(combinedBounds);
            
            if (needsExpansion) {
                this.expandCanvas(combinedBounds);
            }
        }
    }
    
    /**
     * 특정 좌표가 경계 안에 있는지 체크
     */
    isWithinBounds(x, y) {
        const bounds = this.infiniteCanvasManager.bounds;
        return x >= bounds.minX &&
               x <= bounds.maxX &&
               y >= bounds.minY &&
               y <= bounds.maxY;
    }
    
    /**
     * 경계에 여백 추가
     */
    addPadding(bounds, padding = this.padding) {
        return {
            minX: bounds.minX - padding,
            minY: bounds.minY - padding,
            maxX: bounds.maxX + padding,
            maxY: bounds.maxY + padding
        };
    }
    
    /**
     * 캔버스를 특정 크기로 리셋
     */
    resetCanvas(width = 4000, height = 2500) {
        this.infiniteCanvasManager.bounds = {
            minX: -width / 2,
            minY: -height / 2,
            maxX: width / 2,
            maxY: height / 2
        };
        
        this.infiniteCanvasManager.updateBounds();
        console.log('🔄 Canvas reset to:', this.infiniteCanvasManager.bounds);
    }
}

