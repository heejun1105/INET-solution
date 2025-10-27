/**
 * ElementManager.js
 * 평면도 요소 관리
 * 
 * 책임:
 * - 요소 CRUD 작업
 * - 레이어/z-index 관리
 * - 스냅/정렬 기능
 * - 그룹화
 * - 요소 복사/붙여넣기
 */

export default class ElementManager {
    /**
     * @param {FloorPlanCore} core - FloorPlanCore 인스턴스
     */
    constructor(core) {
        if (!core) {
            throw new Error('FloorPlanCore instance is required');
        }
        
        console.log('📦 ElementManager 초기화 시작');
        
        this.core = core;
        
        // 요소 ID 카운터
        this.elementIdCounter = 1;
        
        // 클립보드
        this.clipboard = [];
        
        console.log('✅ ElementManager 초기화 완료');
    }
    
    // ===== CRUD 작업 =====
    
    /**
     * 요소 생성
     * @param {String} elementType - 요소 타입 (room, building, wireless_ap, shape, etc.)
     * @param {Object} properties - 요소 속성
     * @returns {Object} 생성된 요소
     */
    createElement(elementType, properties = {}) {
        const element = {
            id: this.generateElementId(),
            elementType,
            xCoordinate: properties.xCoordinate || 0,
            yCoordinate: properties.yCoordinate || 0,
            width: properties.width || this.getDefaultWidth(elementType),
            height: properties.height || this.getDefaultHeight(elementType),
            zIndex: properties.zIndex || 0,
            ...properties
        };
        
        // 기본값 설정
        this.applyDefaults(element);
        
        // 그리드 스냅 적용
        if (this.core.state.snapToGrid) {
            const snapped = this.core.snapToGrid(element.xCoordinate, element.yCoordinate);
            element.xCoordinate = snapped.x;
            element.yCoordinate = snapped.y;
        }
        
        this.core.addElement(element);
        
        console.debug('➕ 요소 생성:', element.id, elementType);
        
        return element;
    }
    
    /**
     * 요소 업데이트
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     * @param {Object} updates - 업데이트할 속성
     */
    updateElement(elementOrId, updates) {
        const elementId = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
        
        this.core.updateElement(elementId, updates);
        
        console.debug('✏️ 요소 업데이트:', elementId, updates);
    }
    
    /**
     * 요소 삭제 (자식 요소도 함께 삭제)
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     */
    deleteElement(elementOrId) {
        const elementId = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
        
        // 자식 요소 찾기 (이름박스 등)
        const children = this.core.state.elements.filter(el => el.parentElementId === elementId);
        
        // 자식 요소 먼저 삭제
        children.forEach(child => {
            this.core.removeElement(child.id);
            console.debug('🗑️ 자식 요소 삭제:', child.id, '(부모:', elementId, ')');
        });
        
        // 부모 요소 삭제
        this.core.removeElement(elementId);
        
        console.debug('🗑️ 요소 삭제:', elementId, children.length > 0 ? `(자식 ${children.length}개 포함)` : '');
    }
    
    /**
     * 여러 요소 삭제
     * @param {Array} elements - 요소 배열
     */
    deleteElements(elements) {
        for (const element of elements) {
            this.deleteElement(element);
        }
        
        console.debug('🗑️ 요소 삭제:', elements.length, '개');
    }
    
    /**
     * 모든 요소 삭제
     */
    clearAllElements() {
        const allElements = [...this.core.state.elements];
        const count = allElements.length;
        
        // 모든 요소를 역순으로 삭제 (자식부터 삭제하기 위해)
        allElements.reverse().forEach(element => {
            this.core.removeElement(element.id);
        });
        
        console.debug('🗑️ 모든 요소 삭제:', count, '개');
    }
    
    /**
     * 요소 복제 (자식 요소도 함께 복제)
     * @param {Object} element - 복제할 요소
     * @returns {Object} 복제된 요소
     */
    duplicateElement(element) {
        const duplicated = {
            ...element,
            id: this.generateElementId(),
            xCoordinate: element.xCoordinate + 20,
            yCoordinate: element.yCoordinate + 20,
            // referenceId는 복제하지 않음 (임시 ID 될 수 있음)
            referenceId: null
        };
        
        this.core.addElement(duplicated);
        
        // 자식 요소(이름박스 등)도 함께 복제
        const children = this.core.state.elements.filter(el => el.parentElementId === element.id);
        children.forEach(child => {
            const childDuplicated = {
                ...child,
                id: this.generateElementId(),
                parentElementId: duplicated.id, // 새 부모 ID로 변경
                xCoordinate: child.xCoordinate + 20,
                yCoordinate: child.yCoordinate + 20
            };
            this.core.addElement(childDuplicated);
            console.debug('📋 자식 요소 복제:', child.id, '→', childDuplicated.id);
        });
        
        console.debug('📋 요소 복제:', element.id, '→', duplicated.id, children.length > 0 ? `(자식 ${children.length}개 포함)` : '');
        
        return duplicated;
    }
    
    // ===== 레이어/z-index 관리 =====
    
    /**
     * 요소를 앞으로 (자식 요소도 함께)
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     */
    bringForward(elementOrId) {
        const element = typeof elementOrId === 'string' 
            ? this.core.state.elements.find(el => el.id === elementOrId)
            : elementOrId;
        
        if (!element) {
            console.warn('⚠️ 요소를 찾을 수 없습니다:', elementOrId);
            return;
        }
        
        const currentZ = element.zIndex || 0;
        const newZ = currentZ + 1;
        
        // 부모 요소 z-index 변경
        this.updateElement(element, { zIndex: newZ });
        
        // 자식 요소(이름박스 등)도 함께 변경
        const children = this.core.state.elements.filter(el => el.parentElementId === element.id);
        children.forEach(child => {
            this.updateElement(child, { zIndex: newZ });
        });
        
        console.debug('⬆️ 앞으로:', element.id, currentZ, '→', newZ, '(자식:', children.length, '개)');
    }
    
    /**
     * 요소를 뒤로 (자식 요소도 함께)
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     */
    sendBackward(elementOrId) {
        const element = typeof elementOrId === 'string' 
            ? this.core.state.elements.find(el => el.id === elementOrId)
            : elementOrId;
        
        if (!element) {
            console.warn('⚠️ 요소를 찾을 수 없습니다:', elementOrId);
            return;
        }
        
        const currentZ = element.zIndex || 0;
        const newZ = currentZ - 1;
        
        // 부모 요소 z-index 변경
        this.updateElement(element, { zIndex: newZ });
        
        // 자식 요소(이름박스 등)도 함께 변경
        const children = this.core.state.elements.filter(el => el.parentElementId === element.id);
        children.forEach(child => {
            this.updateElement(child, { zIndex: newZ });
        });
        
        console.debug('⬇️ 뒤로:', element.id, currentZ, '→', newZ, '(자식:', children.length, '개)');
    }
    
    /**
     * 요소를 맨 앞으로
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     */
    bringToFront(elementOrId) {
        const element = typeof elementOrId === 'string' 
            ? this.core.state.elements.find(el => el.id === elementOrId)
            : elementOrId;
        
        if (!element) {
            console.warn('⚠️ 요소를 찾을 수 없습니다:', elementOrId);
            return;
        }
        
        const maxZ = Math.max(...this.core.state.elements.map(el => el.zIndex || 0));
        this.updateElement(element, { zIndex: maxZ + 1 });
        
        console.debug('⏫ 맨 앞으로:', element.id);
    }
    
    /**
     * 요소를 맨 뒤로
     * @param {String|Object} elementOrId - 요소 또는 요소 ID
     */
    sendToBack(elementOrId) {
        const element = typeof elementOrId === 'string' 
            ? this.core.state.elements.find(el => el.id === elementOrId)
            : elementOrId;
        
        if (!element) {
            console.warn('⚠️ 요소를 찾을 수 없습니다:', elementOrId);
            return;
        }
        
        const minZ = Math.min(...this.core.state.elements.map(el => el.zIndex || 0));
        this.updateElement(element, { zIndex: minZ - 1 });
        
        console.debug('⏬ 맨 뒤로:', element.id);
    }
    
    // ===== 정렬 =====
    
    /**
     * 요소들을 왼쪽으로 정렬
     * @param {Array} elements - 정렬할 요소들
     */
    alignLeft(elements) {
        if (elements.length < 2) return;
        
        const minX = Math.min(...elements.map(el => el.xCoordinate));
        
        for (const element of elements) {
            this.updateElement(element, { xCoordinate: minX });
        }
        
        console.debug('◀️ 왼쪽 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 오른쪽으로 정렬
     * @param {Array} elements - 정렬할 요소들
     */
    alignRight(elements) {
        if (elements.length < 2) return;
        
        const maxRight = Math.max(...elements.map(el => el.xCoordinate + (el.width || 0)));
        
        for (const element of elements) {
            const width = element.width || 0;
            this.updateElement(element, { xCoordinate: maxRight - width });
        }
        
        console.debug('▶️ 오른쪽 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 위로 정렬
     * @param {Array} elements - 정렬할 요소들
     */
    alignTop(elements) {
        if (elements.length < 2) return;
        
        const minY = Math.min(...elements.map(el => el.yCoordinate));
        
        for (const element of elements) {
            this.updateElement(element, { yCoordinate: minY });
        }
        
        console.debug('🔼 위로 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 아래로 정렬
     * @param {Array} elements - 정렬할 요소들
     */
    alignBottom(elements) {
        if (elements.length < 2) return;
        
        const maxBottom = Math.max(...elements.map(el => el.yCoordinate + (el.height || 0)));
        
        for (const element of elements) {
            const height = element.height || 0;
            this.updateElement(element, { yCoordinate: maxBottom - height });
        }
        
        console.debug('🔽 아래로 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 중앙으로 정렬 (가로)
     * @param {Array} elements - 정렬할 요소들
     */
    alignCenterHorizontal(elements) {
        if (elements.length < 2) return;
        
        const minX = Math.min(...elements.map(el => el.xCoordinate));
        const maxRight = Math.max(...elements.map(el => el.xCoordinate + (el.width || 0)));
        const centerX = (minX + maxRight) / 2;
        
        for (const element of elements) {
            const width = element.width || 0;
            this.updateElement(element, { xCoordinate: centerX - width / 2 });
        }
        
        console.debug('↔️ 가로 중앙 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 중앙으로 정렬 (세로)
     * @param {Array} elements - 정렬할 요소들
     */
    alignCenterVertical(elements) {
        if (elements.length < 2) return;
        
        const minY = Math.min(...elements.map(el => el.yCoordinate));
        const maxBottom = Math.max(...elements.map(el => el.yCoordinate + (el.height || 0)));
        const centerY = (minY + maxBottom) / 2;
        
        for (const element of elements) {
            const height = element.height || 0;
            this.updateElement(element, { yCoordinate: centerY - height / 2 });
        }
        
        console.debug('↕️ 세로 중앙 정렬:', elements.length, '개');
    }
    
    /**
     * 요소들을 균등 분배 (가로)
     * @param {Array} elements - 분배할 요소들
     */
    distributeHorizontal(elements) {
        if (elements.length < 3) return;
        
        // x 좌표로 정렬
        const sorted = [...elements].sort((a, b) => a.xCoordinate - b.xCoordinate);
        
        const minX = sorted[0].xCoordinate;
        const maxRight = sorted[sorted.length - 1].xCoordinate + (sorted[sorted.length - 1].width || 0);
        const totalWidth = maxRight - minX;
        
        const gap = totalWidth / (elements.length - 1);
        
        for (let i = 1; i < sorted.length - 1; i++) {
            const newX = minX + gap * i;
            this.updateElement(sorted[i], { xCoordinate: newX });
        }
        
        console.debug('↔️ 가로 균등 분배:', elements.length, '개');
    }
    
    /**
     * 요소들을 균등 분배 (세로)
     * @param {Array} elements - 분배할 요소들
     */
    distributeVertical(elements) {
        if (elements.length < 3) return;
        
        // y 좌표로 정렬
        const sorted = [...elements].sort((a, b) => a.yCoordinate - b.yCoordinate);
        
        const minY = sorted[0].yCoordinate;
        const maxBottom = sorted[sorted.length - 1].yCoordinate + (sorted[sorted.length - 1].height || 0);
        const totalHeight = maxBottom - minY;
        
        const gap = totalHeight / (elements.length - 1);
        
        for (let i = 1; i < sorted.length - 1; i++) {
            const newY = minY + gap * i;
            this.updateElement(sorted[i], { yCoordinate: newY });
        }
        
        console.debug('↕️ 세로 균등 분배:', elements.length, '개');
    }
    
    // ===== 복사/붙여넣기 =====
    
    /**
     * 요소들을 클립보드에 복사
     * @param {Array} elements - 복사할 요소들
     */
    copyToClipboard(elements) {
        this.clipboard = elements.map(el => ({ ...el }));
        console.debug('📋 클립보드에 복사:', elements.length, '개');
    }
    
    /**
     * 클립보드에서 붙여넣기
     * @returns {Array} 붙여넣은 요소들
     */
    pasteFromClipboard() {
        if (this.clipboard.length === 0) {
            console.debug('📋 클립보드가 비어있음');
            return [];
        }
        
        const pasted = [];
        
        for (const element of this.clipboard) {
            const newElement = {
                ...element,
                id: this.generateElementId(),
                xCoordinate: element.xCoordinate + 20,
                yCoordinate: element.yCoordinate + 20,
                referenceId: null // 임시 ID 제거
            };
            
            this.core.addElement(newElement);
            pasted.push(newElement);
        }
        
        console.debug('📋 클립보드에서 붙여넣기:', pasted.length, '개');
        
        return pasted;
    }
    
    // ===== 그룹화 =====
    
    /**
     * 요소들을 그룹화
     * @param {Array} elements - 그룹화할 요소들
     * @returns {String} 그룹 ID
     */
    groupElements(elements) {
        if (elements.length < 2) {
            console.warn('⚠️ 그룹화는 2개 이상의 요소가 필요합니다');
            return null;
        }
        
        const groupId = `group_${this.generateElementId()}`;
        
        for (const element of elements) {
            this.updateElement(element, { groupId });
        }
        
        console.debug('👥 그룹화:', elements.length, '개 →', groupId);
        
        return groupId;
    }
    
    /**
     * 그룹 해제
     * @param {String} groupId - 그룹 ID
     */
    ungroupElements(groupId) {
        const groupElements = this.core.state.elements.filter(
            el => el.groupId === groupId
        );
        
        for (const element of groupElements) {
            this.updateElement(element, { groupId: null });
        }
        
        console.debug('👥 그룹 해제:', groupElements.length, '개');
    }
    
    // ===== 유틸리티 =====
    
    /**
     * 요소 ID 생성
     */
    generateElementId() {
        return `element_${Date.now()}_${this.elementIdCounter++}`;
    }
    
    /**
     * 요소 타입별 기본 너비
     */
    getDefaultWidth(elementType) {
        switch (elementType) {
            case 'room':
                return 120;
            case 'building':
                return 400;  // 5배 증가
            case 'wireless_ap':
                return 10;
            case 'shape':
                return 100;
            case 'name_box':
                return 80;
            case 'other_space':
                return 100;
            default:
                return 100;
        }
    }
    
    /**
     * 요소 타입별 기본 높이
     */
    getDefaultHeight(elementType) {
        switch (elementType) {
            case 'room':
                return 80;
            case 'building':
                return 750;  // 5배 증가
            case 'wireless_ap':
                return 10;
            case 'shape':
                return 100;
            case 'name_box':
                return 25;
            case 'other_space':
                return 80;
            default:
                return 80;
        }
    }
    
    /**
     * 요소에 기본값 적용
     */
    applyDefaults(element) {
        // 색상 기본값
        if (!element.color) {
            switch (element.elementType) {
                case 'room':
                    element.color = '#10b981';
                    element.borderColor = '#059669';
                    break;
                case 'building':
                    element.color = '#3b82f6';
                    element.borderColor = '#1d4ed8';
                    break;
                case 'wireless_ap':
                    element.color = '#ef4444';
                    element.borderColor = '#dc2626';
                    break;
                default:
                    element.color = '#6b7280';
                    element.borderColor = '#4b5563';
            }
        }
        
        // 기타 기본값
        if (element.opacity == null) {
            element.opacity = 1.0;
        }
        
        if (element.rotation == null) {
            element.rotation = 0;
        }
        
        if (element.borderWidth == null) {
            element.borderWidth = 2;
        }
        
        if (element.showLabel == null) {
            element.showLabel = true;
        }
    }
    
    /**
     * 요소 찾기
     * @param {String} elementId - 요소 ID
     * @returns {Object|null} 요소
     */
    findElement(elementId) {
        return this.core.state.elements.find(el => el.id === elementId) || null;
    }
    
    /**
     * 참조 ID로 요소 찾기
     * @param {Number} referenceId - 참조 ID (교실, 건물 등의 ID)
     * @returns {Object|null} 요소
     */
    findElementByReferenceId(referenceId) {
        return this.core.state.elements.find(el => el.referenceId === referenceId) || null;
    }
    
    /**
     * 위치에서 요소 찾기
     * @param {Number} x - X 좌표 (캔버스 좌표)
     * @param {Number} y - Y 좌표 (캔버스 좌표)
     * @returns {Object|null} 클릭된 요소 (z-index가 가장 높은 것)
     */
    getElementAtPosition(x, y) {
        // z-index 순서대로 정렬 (높은 것부터)
        const sortedElements = [...this.core.state.elements].sort((a, b) => {
            const aOrder = a.layerOrder || a.zIndex || 0;
            const bOrder = b.layerOrder || b.zIndex || 0;
            return bOrder - aOrder;
        });
        
        for (const element of sortedElements) {
            if (this.isPointInElement(x, y, element)) {
                return element;
            }
        }
        
        return null;
    }
    
    /**
     * 점이 요소 내부에 있는지 확인
     * @param {Number} x - X 좌표
     * @param {Number} y - Y 좌표
     * @param {Object} element - 요소
     * @returns {Boolean}
     */
    isPointInElement(x, y, element) {
        // 원형 요소 (무선AP 등)
        if (element.type === 'wireless_ap' && element.radius) {
            const dx = x - element.x;
            const dy = y - element.y;
            return Math.sqrt(dx * dx + dy * dy) <= element.radius;
        }
        
        // 사각형 요소
        const elementX = element.x || element.xCoordinate || 0;
        const elementY = element.y || element.yCoordinate || 0;
        const elementWidth = element.width || 0;
        const elementHeight = element.height || 0;
        
        return x >= elementX &&
               x <= elementX + elementWidth &&
               y >= elementY &&
               y <= elementY + elementHeight;
    }
    
    /**
     * 모든 요소 가져오기
     * @returns {Array} 요소 배열
     */
    getAllElements() {
        return this.core.state.elements || [];
    }
    
    /**
     * 타입별 요소 찾기
     * @param {String} elementType - 요소 타입
     * @returns {Array} 요소 배열
     */
    findElementsByType(elementType) {
        return this.core.state.elements.filter(el => el.elementType === elementType);
    }
    
    /**
     * 그룹별 요소 찾기
     * @param {String} groupId - 그룹 ID
     * @returns {Array} 요소 배열
     */
    findElementsByGroup(groupId) {
        return this.core.state.elements.filter(el => el.groupId === groupId);
    }
    
    /**
     * 요소 통계
     * @returns {Object} 타입별 개수
     */
    getElementStats() {
        const stats = {};
        
        for (const element of this.core.state.elements) {
            const type = element.elementType;
            stats[type] = (stats[type] || 0) + 1;
        }
        
        return stats;
    }
    
    /**
     * 요소 추가 (직접 추가)
     * @param {Object} element - 추가할 요소
     */
    addElement(element) {
        if (!element.id) {
            element.id = this.generateElementId();
        }
        
        this.applyDefaults(element);
        this.core.addElement(element);
        
        console.debug('➕ 요소 추가:', element.id);
    }
    
    /**
     * 요소 제거
     * @param {String} elementId - 요소 ID
     */
    removeElement(elementId) {
        this.core.removeElement(elementId);
        console.debug('➖ 요소 제거:', elementId);
    }
    
    /**
     * 모든 요소 초기화
     */
    clearAllElements() {
        this.core.setState({ elements: [], selectedElements: [] });
        console.debug('🗑️ 모든 요소 초기화');
    }
}

