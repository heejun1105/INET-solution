export default class MultiSelectManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.selectedElements = [];
    }

    selectElement(element, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        if (!this.selectedElements.includes(element)) {
            this.selectedElements.push(element);
            element.classList.add('multi-selected');
        }
        
        this.updateSelectionDisplay();
    }

    selectElements(elements, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        elements.forEach(element => {
            if (!this.selectedElements.includes(element)) {
                this.selectedElements.push(element);
                element.classList.add('multi-selected');
            }
        });
        
        this.updateSelectionDisplay();
    }

    deselectElement(element) {
        const index = this.selectedElements.indexOf(element);
        if (index > -1) {
            this.selectedElements.splice(index, 1);
            element.classList.remove('multi-selected');
        }
        
        this.updateSelectionDisplay();
    }

    toggleElement(element) {
        if (this.selectedElements.includes(element)) {
            this.deselectElement(element);
        } else {
            this.selectElement(element, true);
        }
    }

    clearSelection() {
        // 모든 다중 선택된 요소들의 스타일 제거
        this.selectedElements.forEach(element => {
            element.classList.remove('multi-selected');
        });
        
        // 선택된 요소 배열 초기화
        this.selectedElements = [];
        
        // 선택 상태 표시 업데이트
        this.updateSelectionDisplay();
    }

    updateSelectionDisplay() {
        const count = this.selectedElements.length;
        const infoElement = document.getElementById('multiSelectInfo');
        const textElement = document.getElementById('multiSelectText');
        
        // DOM 요소들이 존재하는지 확인
        if (!infoElement || !textElement) {
            console.warn('다중 선택 표시 요소들을 찾을 수 없습니다.');
            return;
        }
        
        if (count > 1) {
            textElement.textContent = `${count}개 요소 선택됨 - Ctrl+드래그로 그룹 이동`;
            infoElement.classList.add('show');
        } else {
            infoElement.classList.remove('show');
        }
    }

    getSelectedElements() {
        return [...this.selectedElements];
    }

    hasSelection() {
        return this.selectedElements.length > 0;
    }

    getSelectionBounds() {
        if (this.selectedElements.length === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.selectedElements.forEach(element => {
            const left = parseInt(element.style.left) || 0;
            const top = parseInt(element.style.top) || 0;
            const right = left + (parseInt(element.style.width) || 100);
            const bottom = top + (parseInt(element.style.height) || 80);
            
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        });
        
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }
} 