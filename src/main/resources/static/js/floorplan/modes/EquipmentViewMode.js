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
        const elements = this.core.state.elements;
        const roomElements = elements.filter(e => e.elementType === 'room');
        
        roomElements.forEach(room => {
            if (!room.referenceId && !room.classroomId) return;
            
            const classroomId = room.referenceId || room.classroomId;
            const devices = this.devicesByClassroom[classroomId] || [];
            if (devices.length === 0) return;
            
            // 장비 종류별 개수 집계
            const deviceCounts = {};
            devices.forEach(device => {
                const type = device.deviceType || device.type || '기타';
                deviceCounts[type] = (deviceCounts[type] || 0) + 1;
            });
            
            // 카드 배치 계산
            const cards = Object.entries(deviceCounts).map(([type, count]) => ({
                type,
                count,
                color: this.getDeviceColor(type),
                text: `${type} ${count}`
            }));
            
            this.layoutCards(room, cards);
        });
        
        this.core.markDirty();
    }
    
    /**
     * 카드 배치 계산 (여러 줄 지원, 이름박스 회피)
     */
    layoutCards(room, cards) {
        const roomX = room.xCoordinate;
        const roomY = room.yCoordinate;
        const roomW = room.width || 100;
        const roomH = room.height || 80;
        
        // 카드 설정 (3x3 배치, 가로형 교실 240x180)
        // 가로: 240px에 3개 = (240 - 10패딩 - 10간격) / 3 = 73.3px
        // 세로: 180px - 이름박스80px(40+35+5) = 100px
        // 카드: 3줄 × 28px + 2간격 × 3px = 84 + 6 = 90px (여유 10px)
        const cardHeight = 28;     // 30 → 28 (사용자 요청)
        const cardPadding = 5;     // 상하좌우 여백
        const cardMargin = 3;      // 5 → 3 (카드 간 세로 간격)
        const cardsPerRow = 3;     // 가로 3개 고정
        
        // 이름박스 위치 찾기 (겹침 방지)
        const nameBox = this.core.state.elements.find(
            el => el.elementType === 'name_box' && el.parentElementId === room.id
        );
        
        let nameBoxBottom = 0;
        if (nameBox) {
            // 이름박스 하단 절대 위치 + 안전 여백
            nameBoxBottom = nameBox.yCoordinate + (nameBox.height || 35) + 5;  // 40 → 35
        }
        
        // 카드 너비 계산 (가로 3개)
        const cardWidth = (roomW - cardPadding * 2 - cardMargin * (cardsPerRow - 1)) / cardsPerRow;
        
        // 필요한 줄 수
        const totalRows = Math.ceil(cards.length / cardsPerRow);
        
        // 카드 생성
        cards.forEach((card, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            
            // 하단에서 위로 쌓기
            const cardX = roomX + cardPadding + col * (cardWidth + cardMargin);
            let cardY = roomY + roomH - cardPadding - cardHeight - row * (cardHeight + cardMargin);
            
            // 이름박스와 겹치지 않도록 체크
            if (nameBoxBottom > 0 && cardY < nameBoxBottom) {
                console.warn('⚠️ 카드가 이름박스와 겹침 방지:', {
                    카드Y: cardY,
                    이름박스하단: nameBoxBottom,
                    교실: room.label
                });
                // 카드를 이름박스 아래로 제한
                cardY = nameBoxBottom;
            }
            
            const cardElement = {
                id: `equipment_card_${room.id}_${index}`,
                elementType: 'equipment_card',
                parentElementId: room.id,
                xCoordinate: cardX,
                yCoordinate: cardY,
                width: cardWidth,
                height: cardHeight,
                deviceType: card.type,
                count: card.count,
                color: card.color,
                zIndex: 1000
            };
            
            this.core.state.elements.push(cardElement);
        });
    }
    
    /**
     * 장비 종류별 색상 (데이터베이스 기준, 가시성 최적화)
     */
    getDeviceColor(type) {
        // 데이터베이스에 존재하는 8가지 장비 종류 (2025-10-30 기준)
        const colors = {
            'TV': '#dc2626',           // 진한 빨강 (Red 700)
            '노트북': '#7c3aed',        // 진한 보라 (Violet 600)
            '데스크톱': '#4b5563',      // 진한 회색 (Gray 600)
            '모니터': '#2563eb',        // 진한 파랑 (Blue 600)
            '전자칠판': '#16a34a',      // 진한 녹색 (Green 600)
            '키오스크': '#0891b2',      // 진한 청록 (Cyan 600)
            '프로젝터': '#ea580c',      // 진한 주황 (Orange 600)
            '프린터': '#db2777',        // 진한 핑크 (Pink 600)
            // 기타 장비는 기본 회색으로 통일
            'default': '#6b7280'       // 회색 (Gray 500)
        };
        
        // 데이터베이스에 없는 장비는 기본 색상 사용
        return colors[type] || colors['default'];
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
        // core.state.elements에서 직접 제거
        this.core.state.elements = this.core.state.elements.filter(
            e => e.elementType !== 'equipment_card'
        );
        this.core.markDirty();
    }
}

