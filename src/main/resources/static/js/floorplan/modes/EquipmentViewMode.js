/**
 * EquipmentViewMode.js
 * 장비 보기 모드 매니저
 * 
 * 책임:
 * - 교실별 장비 카드 자동 생성 및 표시
 * - 장비 종류별 색상 구분
 * - 교실 클릭 시 자리배치 모달 표시
 */

export default class EquipmentViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.devicesByClassroom = {};
        
        console.log('📦 EquipmentViewMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        console.log('✅ 장비보기 모드 활성화');
        await this.loadDevices();
        this.renderEquipmentCards();
        this.bindEvents();
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 장비보기 모드 비활성화');
        this.clearEquipmentCards();
        this.unbindEvents();
    }
    
    /**
     * 장비 데이터 로드
     */
    async loadDevices() {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/devices-by-classroom`);
            const result = await response.json();
            
            if (result.success) {
                this.devicesByClassroom = result.devicesByClassroom;
            }
        } catch (error) {
            console.error('장비 로드 오류:', error);
        }
    }
    
    /**
     * 장비 카드 렌더링
     */
    renderEquipmentCards() {
        const elements = this.elementManager.getAllElements();
        const roomElements = elements.filter(e => e.type === 'room');
        
        roomElements.forEach(room => {
            if (!room.referenceId) return;
            
            const devices = this.devicesByClassroom[room.referenceId] || [];
            if (devices.length === 0) return;
            
            // 장비 종류별 개수 집계
            const deviceCounts = {};
            devices.forEach(device => {
                const type = device.type;
                deviceCounts[type] = (deviceCounts[type] || 0) + 1;
            });
            
            // 카드 요소 생성
            Object.entries(deviceCounts).forEach(([type, count], index) => {
                const cardElement = {
                    type: 'equipment_card',
                    parentElementId: room.id,
                    x: room.x + 5,
                    y: room.y + room.height - 30 - (index * 25),
                    width: room.width - 10,
                    height: 20,
                    deviceType: type,
                    count: count,
                    color: this.getDeviceColor(type),
                    layerOrder: 1000
                };
                
                this.elementManager.addElement(cardElement);
            });
        });
        
        this.core.markDirty();
    }
    
    /**
     * 장비 종류별 색상
     */
    getDeviceColor(type) {
        const colors = {
            'TV': '#ef4444',
            'PC': '#3b82f6',
            '전자교탁': '#10b981',
            '프로젝터': '#f59e0b',
            '스피커': '#8b5cf6',
            '실물화상기': '#ec4899',
            '기타': '#6b7280'
        };
        
        return colors[type] || colors['기타'];
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        this.canvasClickHandler = (e) => this.handleCanvasClick(e);
        
        const canvas = this.core.canvas;
        canvas.addEventListener('click', this.canvasClickHandler);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasClickHandler) {
            canvas.removeEventListener('click', this.canvasClickHandler);
        }
    }
    
    /**
     * 캔버스 클릭 처리
     */
    handleCanvasClick(e) {
        const rect = this.core.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 클릭된 요소 찾기
        const clickedElement = this.elementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
        
        if (clickedElement && clickedElement.type === 'room') {
            // 자리배치 모달 열기 (SeatLayoutMode와 유사)
            console.log('교실 클릭:', clickedElement);
            this.uiManager.showNotification('자리배치 모달 (구현 예정)', 'info');
        }
    }
    
    /**
     * 장비 카드 제거
     */
    clearEquipmentCards() {
        const elements = this.elementManager.getAllElements();
        const cardElements = elements.filter(e => e.type === 'equipment_card');
        
        cardElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
}

