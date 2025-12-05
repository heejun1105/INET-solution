/**
 * EquipmentViewMode.js
 * 장비 보기 모드 매니저
 * 
 * 책임:
 * - 교실별 장비 카드 자동 생성 및 표시
 * - 장비 종류별 색상 구분
 * - 교실 클릭 시 자리배치 모달 표시
 */

import SeatLayoutMode from './SeatLayoutMode.js';
import LegendComponent from '../components/LegendComponent.js';

export default class EquipmentViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.devicesByClassroom = {};
        
        // 자리배치 모달을 위한 SeatLayoutMode 인스턴스
        this.seatLayoutMode = new SeatLayoutMode(core, elementManager, uiManager);
        
        // 범례 컴포넌트
        this.legendComponent = new LegendComponent(core, 'equipment');
        
        console.log('📦 EquipmentViewMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        try {
        console.log('✅ 장비보기 모드 활성화');
        
        // 모든 요소 잠금 (보기 모드에서는 이동 불가)
        this.lockAllElements();
        
        await this.loadDevices();
        this.renderEquipmentCards();
        this.bindEvents();
        
        // 범례 생성
            if (this.legendComponent && typeof this.legendComponent.create === 'function') {
        this.legendComponent.create();
            }
        
        // 강제 렌더링
        this.core.markDirty();
        } catch (error) {
            console.error('❌ 장비보기 모드 활성화 오류:', error);
            throw error; // 에러를 다시 throw하여 상위에서 처리할 수 있도록
        }
    }
    
    /**
     * 모든 요소 잠금
     */
    lockAllElements() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            element.isLocked = true;
            this.elementManager.updateElement(element.id, { isLocked: true });
        });
        console.log('🔒 모든 요소 잠금 (장비보기 모드)');
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 장비보기 모드 비활성화');
        this.clearEquipmentCards();
        this.unbindEvents();
        this.legendComponent.remove();
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
        try {
            if (!this.core || !this.core.state || !this.core.state.elements) {
                console.warn('⚠️ Core 또는 state가 초기화되지 않았습니다.');
                return;
            }
            
        const elements = this.core.state.elements;
            const roomElements = elements.filter(e => e && e.elementType === 'room');
        
        roomElements.forEach(room => {
                try {
                    if (!room || (!room.referenceId && !room.classroomId)) return;
            
            const classroomId = room.referenceId || room.classroomId;
            const devices = this.devicesByClassroom[classroomId] || [];
            if (devices.length === 0) return;
            
            // 고유번호 카테고리별 개수 집계
            const deviceCounts = {};
            devices.forEach(device => {
                const cate = device.uidCate || '미분류';  // 고유번호 카테고리 사용
                deviceCounts[cate] = (deviceCounts[cate] || 0) + 1;
            });
            
            // 카드 배치 계산
            const cards = Object.entries(deviceCounts).map(([cate, count]) => ({
                type: cate,  // 카테고리를 type으로 전달
                count,
                color: this.getDeviceColor(cate),
                text: `${cate} ${count}`
            }));
            
            this.layoutCards(room, cards);
                } catch (error) {
                    console.error('❌ 교실 장비 렌더링 오류:', error, room);
                }
        });
        
        this.core.markDirty();
        } catch (error) {
            console.error('❌ 장비 카드 렌더링 오류:', error);
        }
    }
    
    /**
     * 텍스트 형태로 장비 표시 (카드 형태 제거)
     */
    layoutCards(room, cards) {
        const roomX = room.xCoordinate;
        const roomY = room.yCoordinate;
        const roomW = room.width || 100;
        const roomH = room.height || 80;
        
        // 텍스트 생성: "TV 1, DK 6, ..." 형식
        const textParts = cards.map(card => `${card.type} ${card.count}`);
        const text = textParts.join(', ');
        
        // 위치: 교실 높이의 3/5 지점
        const textY = roomY + (roomH * 3 / 5);
        const textX = roomX; // 중앙 정렬을 위해 x는 교실 시작점으로 설정 (렌더링 시 중앙 계산)
        
        // 텍스트 요소 생성 (카드 형태 제거)
        const textElement = {
            id: `equipment_text_${room.id}`,
            elementType: 'equipment_card', // 렌더링 타입은 유지하되 내용만 텍스트
                parentElementId: room.id,
            xCoordinate: textX,
            yCoordinate: textY,
            width: roomW, // 교실 전체 너비 사용 (중앙 정렬)
            height: roomH / 3, // 교실 높이의 1/3 (아래 3분의 1 영역)
            roomHeight: roomH, // 교실 높이 정보 저장 (폰트 크기 계산용)
            text: text, // 전체 텍스트
            cards: cards, // 개별 카드 정보 (줄바꿈 계산용)
                zIndex: 1000
            };
            
        this.core.state.elements.push(textElement);
    }
    
    /**
     * 장비 종류별 색상 (데이터베이스 기준, 가시성 최적화 - WCAG AAA 대비)
     */
    getDeviceColor(cate) {
        // 고유번호 카테고리별 색상 매핑 (데이터베이스 기준)
        // 더 어두운 700-800 계열 사용 → 흰색 텍스트와 대비비율 7:1 이상 (WCAG AAA)
        const colors = {
            // 데이터베이스 카테고리 (9개)
            'TV': '#b91c1c',           // 매우 진한 빨강 (Red 800) - TV
            'MO': '#1e40af',           // 매우 진한 파랑 (Blue 800) - 모니터
            'DC': '#374151',           // 매우 진한 회색 (Gray 700) - 데스크톱
            'DK': '#6d28d9',           // 매우 진한 보라 (Violet 700) - 도킹스테이션
            'DW': '#0e7490',           // 매우 진한 청록 (Cyan 700) - 무선장비
            'ET': '#15803d',           // 매우 진한 녹색 (Green 700) - 전자칠판
            'ID': '#be185d',           // 매우 진한 핑크 (Pink 700) - 학생용ID
            'PJ': '#c2410c',           // 매우 진한 주황 (Orange 700) - 프로젝터
            'PR': '#9333ea',           // 매우 진한 자주 (Purple 700) - 프린터
            // 미분류
            '미분류': '#4b5563',       // 진한 회색 (Gray 600)
            'default': '#4b5563'       // 진한 회색 (Gray 600)
        };
        
        // 매핑에 없는 카테고리는 기본 색상 사용
        return colors[cate] || colors['default'];
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // mousedown 이벤트를 capture 단계에서 먼저 처리하여 InteractionManager보다 우선 실행
        this.canvasMouseDownHandler = (e) => this.handleCanvasMouseDown(e);
        
        const canvas = this.core.canvas;
        // capture 단계에서 이벤트 처리 (InteractionManager보다 먼저 실행)
        canvas.addEventListener('mousedown', this.canvasMouseDownHandler, true);
        
        // 터치 이벤트도 처리
        this.canvasTouchStartHandler = (e) => this.handleCanvasTouchStart(e);
        canvas.addEventListener('touchstart', this.canvasTouchStartHandler, true);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasMouseDownHandler) {
            canvas.removeEventListener('mousedown', this.canvasMouseDownHandler, true);
        }
        if (this.canvasTouchStartHandler) {
            canvas.removeEventListener('touchstart', this.canvasTouchStartHandler, true);
        }
    }
    
    /**
     * 캔버스 마우스 다운 처리 (보기 모드에서 잠긴 교실 클릭 허용)
     */
    handleCanvasMouseDown(e) {
        console.log('🔍 [장비보기] handleCanvasMouseDown 호출됨');
        console.log('🔍 [장비보기] 현재 모드:', this.core.state.currentMode);
        
        // 장비 보기 모드가 아니면 무시
        if (this.core.state.currentMode !== 'view-equipment') {
            console.log('⚠️ [장비보기] 장비 보기 모드가 아님, 무시');
            return;
        }
        
        // 우클릭은 무시
        if (e.button === 2) {
            console.log('⚠️ [장비보기] 우클릭 무시');
            return;
        }
        
        // InteractionManager와 동일한 방식으로 좌표 계산
        // screenToCanvas는 clientX, clientY를 직접 받아야 함
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        console.log('🔍 [장비보기] 클릭 위치 (화면 clientX/Y):', { 
            clientX: e.clientX, 
            clientY: e.clientY 
        });
        console.log('🔍 [장비보기] 클릭 위치 (캔버스):', canvasPos);
        
        // 직접 요소를 찾기 (equipment_card는 제외)
        const sortedElements = [...this.core.state.elements].sort((a, b) => {
            const aOrder = a.layerOrder || a.zIndex || 0;
            const bOrder = b.layerOrder || b.zIndex || 0;
            return bOrder - aOrder;
        });
        
        console.log('🔍 [장비보기] 전체 요소 수:', this.core.state.elements.length);
        console.log('🔍 [장비보기] 정렬된 요소 수:', sortedElements.length);
        
        let clickedElement = null;
        let checkedCount = 0;
        
        for (const element of sortedElements) {
            // equipment_card는 무시
            if (element.elementType === 'equipment_card') {
                checkedCount++;
                continue;
            }
            
            // 요소 영역 확인
            const elementX = element.x || element.xCoordinate || 0;
            const elementY = element.y || element.yCoordinate || 0;
            const elementWidth = element.width || 0;
            const elementHeight = element.height || 0;
            
            const isInBounds = canvasPos.x >= elementX && 
                              canvasPos.x <= elementX + elementWidth &&
                              canvasPos.y >= elementY && 
                              canvasPos.y <= elementY + elementHeight;
            
            if (isInBounds) {
                clickedElement = element;
                console.log('✅ [장비보기] 클릭된 요소 발견:', {
                    id: element.id,
                    elementType: element.elementType,
                    label: element.label,
                    x: elementX,
                    y: elementY,
                    width: elementWidth,
                    height: elementHeight,
                    isLocked: element.isLocked
                });
                break;
            }
            checkedCount++;
        }
        
        console.log('🔍 [장비보기] 체크한 요소 수:', checkedCount);
        
        if (!clickedElement) {
            console.log('⚠️ [장비보기] 클릭된 요소 없음');
        }
        
        // 교실 또는 이름박스 클릭 확인
        let targetRoom = null;
        
        if (clickedElement) {
            if (clickedElement.elementType === 'name_box') {
                console.log('🔍 [장비보기] 이름박스 클릭됨, 부모 요소 찾는 중...');
                // 이름 박스인 경우 부모 요소 찾기
                if (clickedElement.parentElementId) {
                    const parentElement = this.core.state.elements.find(
                        el => el.id === clickedElement.parentElementId
                    );
                    console.log('🔍 [장비보기] 부모 요소:', parentElement);
                    if (parentElement && parentElement.elementType === 'room') {
                        targetRoom = parentElement;
                        console.log('✅ [장비보기] 부모 교실 찾음:', targetRoom);
                    }
                } else {
                    console.log('⚠️ [장비보기] 이름박스에 parentElementId 없음');
                }
            } else if (clickedElement.elementType === 'room') {
                targetRoom = clickedElement;
                console.log('✅ [장비보기] 교실 직접 클릭됨:', targetRoom);
            } else {
                console.log('⚠️ [장비보기] 교실 또는 이름박스가 아님:', clickedElement.elementType);
            }
        }
        
        // 교실 클릭 시 모달 열기 (이벤트 전파 중지하여 InteractionManager로 전달 방지)
        if (targetRoom) {
            console.log('🎯 [장비보기] 교실 클릭 감지, 모달 열기 시도...');
            e.stopPropagation(); // InteractionManager로 이벤트 전달 방지
            e.stopImmediatePropagation(); // 같은 단계의 다른 리스너도 차단
            e.preventDefault(); // 기본 동작 방지
            console.log('✅ [장비보기] 이벤트 전파 차단 완료, 모달 열기 호출');
            console.log('✅ [장비보기] 교실 정보:', {
                id: targetRoom.id,
                label: targetRoom.label,
                referenceId: targetRoom.referenceId,
                classroomId: targetRoom.classroomId
            });
            this.openClassroomModal(targetRoom);
            return false; // 추가 안전장치
        } else {
            console.log('⚠️ [장비보기] targetRoom이 null, 모달 열기 안함');
        }
    }
    
    /**
     * 캔버스 터치 시작 처리 (모바일/태블릿)
     */
    handleCanvasTouchStart(e) {
        console.log('🔍 [장비보기] handleCanvasTouchStart 호출됨');
        console.log('🔍 [장비보기] 현재 모드:', this.core.state.currentMode);
        
        // 장비 보기 모드가 아니면 무시
        if (this.core.state.currentMode !== 'view-equipment') {
            console.log('⚠️ [장비보기] 장비 보기 모드가 아님, 무시');
            return;
        }
        
        if (e.touches.length !== 1) {
            console.log('⚠️ [장비보기] 단일 터치가 아님:', e.touches.length);
            return; // 단일 터치만 처리
        }
        
        const touch = e.touches[0];
        
        // InteractionManager와 동일한 방식으로 좌표 계산
        // screenToCanvas는 clientX, clientY를 직접 받아야 함
        const canvasPos = this.core.screenToCanvas(touch.clientX, touch.clientY);
        
        console.log('🔍 [장비보기] 터치 위치 (화면 clientX/Y):', { 
            clientX: touch.clientX, 
            clientY: touch.clientY 
        });
        console.log('🔍 [장비보기] 터치 위치 (캔버스):', canvasPos);
        
        // 직접 요소를 찾기 (equipment_card는 제외)
        const sortedElements = [...this.core.state.elements].sort((a, b) => {
            const aOrder = a.layerOrder || a.zIndex || 0;
            const bOrder = b.layerOrder || b.zIndex || 0;
            return bOrder - aOrder;
        });
        
        console.log('🔍 [장비보기] 전체 요소 수:', this.core.state.elements.length);
        
        let clickedElement = null;
        for (const element of sortedElements) {
            // equipment_card는 무시
            if (element.elementType === 'equipment_card') {
                continue;
            }
            
            // 요소 영역 확인
            const elementX = element.x || element.xCoordinate || 0;
            const elementY = element.y || element.yCoordinate || 0;
            const elementWidth = element.width || 0;
            const elementHeight = element.height || 0;
            
            if (canvasPos.x >= elementX && 
                canvasPos.x <= elementX + elementWidth &&
                canvasPos.y >= elementY && 
                canvasPos.y <= elementY + elementHeight) {
                clickedElement = element;
                console.log('✅ [장비보기] 터치된 요소 발견:', {
                    id: element.id,
                    elementType: element.elementType,
                    label: element.label
                });
                break;
            }
        }
        
        // 교실 또는 이름박스 클릭 확인
        let targetRoom = null;
        
        if (clickedElement) {
            if (clickedElement.elementType === 'name_box') {
                console.log('🔍 [장비보기] 이름박스 터치됨, 부모 요소 찾는 중...');
                // 이름 박스인 경우 부모 요소 찾기
                if (clickedElement.parentElementId) {
                    const parentElement = this.core.state.elements.find(
                        el => el.id === clickedElement.parentElementId
                    );
                    if (parentElement && parentElement.elementType === 'room') {
                        targetRoom = parentElement;
                        console.log('✅ [장비보기] 부모 교실 찾음:', targetRoom);
                    }
                }
            } else if (clickedElement.elementType === 'room') {
                targetRoom = clickedElement;
                console.log('✅ [장비보기] 교실 직접 터치됨:', targetRoom);
            }
        }
        
        // 교실 터치 시 모달 열기
        if (targetRoom) {
            console.log('🎯 [장비보기] 교실 터치 감지, 모달 열기 시도...');
            e.stopPropagation(); // InteractionManager로 이벤트 전달 방지
            e.stopImmediatePropagation(); // 같은 단계의 다른 리스너도 차단
            e.preventDefault(); // 기본 동작 방지
            console.log('✅ [장비보기] 이벤트 전파 차단 완료, 모달 열기 호출');
            this.openClassroomModal(targetRoom);
        } else {
            console.log('⚠️ [장비보기] targetRoom이 null, 모달 열기 안함');
        }
    }
    
    /**
     * 교실 모달 열기
     */
    async openClassroomModal(roomElement) {
        console.log('🎯 [장비보기] openClassroomModal 호출됨');
        console.log('🎯 [장비보기] 교실 요소:', {
            id: roomElement.id,
            label: roomElement.label,
            referenceId: roomElement.referenceId,
            classroomId: roomElement.classroomId
        });
        
        try {
            // SeatLayoutMode의 openClassroomModal 메서드 재사용
            console.log('🎯 [장비보기] SeatLayoutMode.openClassroomModal 호출 중...');
            await this.seatLayoutMode.openClassroomModal(roomElement);
            console.log('✅ [장비보기] 모달 열기 완료');
        } catch (error) {
            console.error('❌ [장비보기] 모달 열기 실패:', error);
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

