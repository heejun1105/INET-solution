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
            
            // 선택 시에도 테두리 스타일 유지
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
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
                
                // 선택 시에도 테두리 스타일 유지
                if (element.classList.contains('building') || element.classList.contains('room')) {
                    this.floorPlanManager.restoreBorderStyle(element);
                }
            }
        });
        
        this.updateSelectionDisplay();
    }

    deselectElement(element) {
        const index = this.selectedElements.indexOf(element);
        if (index > -1) {
            this.selectedElements.splice(index, 1);
            element.classList.remove('multi-selected');
            
            // 선택 해제 시 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
        }
        
        this.updateSelectionDisplay();
    }

    toggleElement(element) {
        const index = this.selectedElements.indexOf(element);
        if (index !== -1) {
            // 이미 선택된 요소라면 선택 해제
            this.selectedElements.splice(index, 1);
            element.classList.remove('multi-selected');
            
            // 선택 해제 시 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
        } else {
            // 선택되지 않은 요소라면 선택 추가
            this.selectedElements.push(element);
            element.classList.add('multi-selected');
            
            // 선택 시에도 테두리 스타일 유지
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
        }
    }

    clearSelection() {
        this.selectedElements.forEach(element => {
            element.classList.remove('multi-selected');
            
            // 선택 해제 시 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
        });
        this.selectedElements = [];
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
            textElement.textContent = `${count}개 요소 선택됨`;
            infoElement.classList.add('show');
        } else {
            infoElement.classList.remove('show');
        }
    }

    getSelectedElements() {
        return this.selectedElements;
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

    // 요소가 선택되었는지 확인하는 메서드 추가
    isSelected(element) {
        return this.selectedElements.includes(element);
    }

    // 선택 목록에 요소 추가하는 메서드 추가
    addToSelection(element) {
        if (!this.isSelected(element)) {
            this.selectedElements.push(element);
            element.classList.add('multi-selected');
            
            // 선택 시에도 테두리 스타일 유지
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
            
            // 도형 요소인 경우 선택 스타일 적용
            if (element.classList.contains('shape')) {
                element.classList.add('selected');
            }
            
            this.updateSelectionDisplay();
        }
    }

    // 선택 목록에서 요소 제거하는 메서드 수정
    removeFromSelection(element) {
        const index = this.selectedElements.indexOf(element);
        if (index > -1) {
            this.selectedElements.splice(index, 1);
            element.classList.remove('multi-selected');
            
            // 도형 요소인 경우 선택 스타일 제거
            if (element.classList.contains('shape')) {
                element.classList.remove('selected');
            }
            
            // 선택 해제 시 테두리 스타일 복원
            if (element.classList.contains('building') || element.classList.contains('room')) {
                this.floorPlanManager.restoreBorderStyle(element);
            }
        }
        
        this.updateSelectionDisplay();
    }
} 