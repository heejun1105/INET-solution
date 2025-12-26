/**
 * WirelessApViewMode.js
 * 무선AP 보기 모드 매니저
 * 
 * 책임:
 * - 저장된 무선AP 표시 (읽기 전용)
 * - 네트워크 장비 표시
 */

import LegendComponent from '../components/LegendComponent.js';

export default class WirelessApViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        // 범례 컴포넌트
        this.legendComponent = new LegendComponent(core, 'wireless-ap');
        
        console.log('📡 WirelessApViewMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        console.log('✅ 무선AP보기 모드 활성화');
        
        // 모든 요소 잠금 (보기 모드에서는 이동 불가)
        this.lockAllElements();
        
        // 먼저 기존 AP/MDF 요소 제거
        this.clearApElements();
        
        // 저장된 AP/MDF 로드
        await this.loadSavedApMdfElements();
        
        // 무선AP 데이터 로드 및 렌더링
        await this.loadAndRenderWirelessAps();
        
        // 범례 생성
        this.legendComponent.create();
        
        // 강제 렌더링
        this.core.markDirty();
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
        console.log('🔒 모든 요소 잠금 (무선AP보기 모드)');
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 무선AP보기 모드 비활성화');
        this.clearApElements();
        this.legendComponent.remove();
    }
    
    /**
     * 페이지 전환 시 호출 (main_new_v3.js에서 호출)
     */
    onPageSwitch(pageNumber) {
        console.log(`📄 무선AP 보기 모드 - 페이지 전환: ${pageNumber}`);
        
        // core.currentPage 업데이트
        if (this.core) {
            this.core.currentPage = pageNumber;
        }
        
        // 현재 페이지의 AP만 다시 렌더링
        // 기존 AP 요소 제거 후 다시 로드
        this.clearApElements();
        this.loadAndRenderWirelessAps();
    }
    
    /**
     * 무선AP 로드 및 렌더링
     */
    async loadAndRenderWirelessAps() {
        try {
            const schoolId = this.core.currentSchoolId;
            
            // 무선AP 로드
            const apResponse = await fetch(`/floorplan/api/schools/${schoolId}/wireless-aps`);
            const apResult = await apResponse.json();
            
            if (apResult.success) {
                this.renderWirelessAps(apResult.wirelessAps);
            }
            
            // 네트워크 장비 로드
            const equipResponse = await fetch(`/api/network-equipment/schools/${schoolId}`);
            const equipResult = await equipResponse.json();
            
            if (equipResult.success) {
                this.renderNetworkEquipments(equipResult.equipments);
            }
            
            this.core.markDirty();
        } catch (error) {
            console.error('무선AP 로드 오류:', error);
        }
    }
    
    /**
     * 저장된 AP/MDF 요소 로드
     */
    async loadSavedApMdfElements() {
        try {
            const schoolId = this.core.currentSchoolId;
            if (!schoolId) return;
            
            // 평면도 데이터 로드
            const response = await fetch(`/floorplan/api/schools/${schoolId}`);
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.elements) {
                console.log('ℹ️ 저장된 AP/MDF 데이터 없음');
                return;
            }
            
            const elements = result.data.elements;
            const savedAps = elements.filter(el => el.elementType === 'wireless_ap');
            const savedMdfs = elements.filter(el => el.elementType === 'mdf_idf');
            
            console.log('📥 저장된 AP/MDF 로드 (보기 모드):', {
                ap: savedAps.length,
                mdf: savedMdfs.length
            });
            
            // 저장된 MDF 요소 추가
            savedMdfs.forEach(mdfData => {
                const mdfElement = {
                    id: mdfData.id || `mdf_${Date.now()}_${Math.random()}`,
                    elementType: 'mdf_idf',
                    xCoordinate: mdfData.xCoordinate,
                    yCoordinate: mdfData.yCoordinate,
                    width: mdfData.width || 40,
                    height: mdfData.height || 60,
                    borderColor: mdfData.borderColor || '#000000',
                    backgroundColor: mdfData.backgroundColor || '#ef4444',
                    borderWidth: mdfData.borderWidth || 2,
                    zIndex: mdfData.zIndex || 900,
                    isLocked: true // 읽기 전용
                };
                
                this.elementManager.addElement(mdfElement);
                console.log('✅ 저장된 MDF 로드 (보기 모드):', mdfElement);
            });
            
            // 저장된 AP 위치 맵 생성 (referenceId 기준)
            // 무선AP 위치는 "교실 기준 좌표"로 관리한다.
            // - 백엔드에서 전달되는 xCoordinate, yCoordinate는 교실 기준 좌표(상대 좌표)로 간주한다.
            // - 렌더링 시에는 항상 교실 위치(roomElement.xCoordinate, yCoordinate)에 상대 좌표를 더해 실제 위치를 계산한다.
            this.savedApPositions = {};
            savedAps.forEach(apData => {
                if (apData.referenceId) {
                    const shapeType = apData.shapeType || 'circle';
                    let width = apData.width;
                    let height = apData.height;
                    
                    // circle 또는 circle-l인 경우 radius로부터 width/height 계산
                    if ((shapeType === 'circle' || shapeType === 'circle-l') && apData.radius) {
                        width = apData.radius * 2;
                        height = apData.radius * 2;
                    } else {
                        width = width || 40;
                        height = height || 40;
                    }
                    
                    // 교실 기준 상대 좌표 (offset) 그대로 사용
                    const offsetX = apData.xCoordinate || 0;
                    const offsetY = apData.yCoordinate || 0;
                    
                    this.savedApPositions[apData.referenceId] = {
                        // 교실 기준 상대 좌표 (offset)
                        x: offsetX,
                        y: offsetY,
                        backgroundColor: apData.backgroundColor,
                        borderColor: apData.borderColor,
                        letterColor: apData.letterColor || '#000000',
                        shapeType: shapeType,
                        width: width,
                        height: height,
                        radius: (shapeType === 'circle' || shapeType === 'circle-l') ? (apData.radius || width / 2) : null
                    };
                }
            });
            
        } catch (error) {
            console.error('저장된 AP/MDF 로드 오류 (보기 모드):', error);
        }
    }
    
    /**
     * 저장된 AP 위치 가져오기
     */
    getSavedApPosition(apId) {
        if (!this.savedApPositions) return null;
        return this.savedApPositions[apId] || null;
    }
    
    /**
     * 무선AP 렌더링
     */
    renderWirelessAps(wirelessAps) {
        console.log('📡 무선AP 보기 모드 - 렌더링 시작:', wirelessAps.length, '개');
        
        let createdCount = 0;
        let skippedCount = 0;
        
        wirelessAps.forEach(ap => {
            if (!ap.classroomId) {
                skippedCount++;
                return;
            }
            
            // classroomId를 숫자로 변환
            const targetClassroomId = typeof ap.classroomId === 'string' 
                ? parseInt(ap.classroomId, 10) 
                : ap.classroomId;
            
            if (!targetClassroomId || isNaN(targetClassroomId)) {
                console.log('⚠️ 유효하지 않은 classroomId:', ap.classroomId, 'AP:', ap.apId);
                skippedCount++;
                return;
            }
            
            // 교실 요소 찾기 (WirelessApDesignMode와 동일한 로직)
            let roomElement = this.elementManager.findElementByReferenceId(targetClassroomId);
            
            // referenceId로 찾지 못한 경우 다른 방법으로 찾기 시도
            if (!roomElement) {
                const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                roomElement = allRooms.find(r => {
                    // 1. referenceId로 매칭 (타입 변환)
                    const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                    if (rRefId && rRefId === targetClassroomId) {
                        return true;
                    }
                    // 2. classroomId로 매칭 (타입 변환)
                    const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                    if (rClassroomId && rClassroomId === targetClassroomId) {
                        return true;
                    }
                    // 3. element_data에서 classroomId 확인
                    if (r.elementData) {
                        try {
                            const elementData = typeof r.elementData === 'string' 
                                ? JSON.parse(r.elementData) 
                                : r.elementData;
                            if (elementData) {
                                const dataClassroomId = typeof elementData.classroomId === 'string' 
                                    ? parseInt(elementData.classroomId, 10) 
                                    : elementData.classroomId;
                                if (dataClassroomId && dataClassroomId === targetClassroomId) {
                                    return true;
                                }
                                // referenceId도 확인
                                const dataRefId = typeof elementData.referenceId === 'string' 
                                    ? parseInt(elementData.referenceId, 10) 
                                    : elementData.referenceId;
                                if (dataRefId && dataRefId === targetClassroomId) {
                                    return true;
                                }
                            }
                        } catch (e) {
                            // 파싱 실패 시 무시
                        }
                    }
                    return false;
                }) || null;
            }
            
            if (!roomElement) {
                console.log('⚠️ 교실 요소를 찾을 수 없음 - classroomId:', targetClassroomId, '(원본:', ap.classroomId, ')', '교실명:', ap.classroomName, 'AP ID:', ap.apId);
                skippedCount++;
                return;
            }
            
            // 저장된 위치 확인
            const savedPosition = this.getSavedApPosition(ap.apId);
            
            const DEFAULT_RADIUS = 20;
            const DEFAULT_SIZE = DEFAULT_RADIUS * 2;
            let shapeType = 'circle';
            let width = DEFAULT_SIZE;
            let height = DEFAULT_SIZE;
            let radius = DEFAULT_RADIUS;
            let centerX;
            let centerY;
            let backgroundColor = '#ef4444';
            let borderColor = '#000000';
            let letterColor = '#000000';
            
            if (savedPosition) {
                shapeType = savedPosition.shapeType || 'circle';
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
                
                // 저장된 위치는 교실 기준 오프셋이므로 절대 좌표로 변환
                const offsetX = savedPosition.x || 0;
                const offsetY = savedPosition.y || 0;
                centerX = roomElement.xCoordinate + offsetX;
                centerY = roomElement.yCoordinate + offsetY;
                
                // circle 또는 circle-l인 경우
                if (shapeType === 'circle' || shapeType === 'circle-l') {
                    radius = savedPosition.radius ?? DEFAULT_RADIUS;
                    width = radius * 2;
                    height = radius * 2;
                } else {
                    width = savedPosition.width || DEFAULT_SIZE;
                    height = savedPosition.height || DEFAULT_SIZE;
                }
            } else {
                // 기본 위치 (교실 중앙 살짝 아래)
                shapeType = 'circle';
                const baseCenterX = roomElement.xCoordinate + (roomElement.width || 100) / 2;
                const baseCenterY = roomElement.yCoordinate + (roomElement.height || 100) / 2 + 30;
                centerX = baseCenterX;
                centerY = baseCenterY;
                radius = DEFAULT_RADIUS;
                width = DEFAULT_SIZE;
                height = DEFAULT_SIZE;
            }
            
            // 좌상단 좌표 계산
            const x = centerX - width / 2;
            const y = centerY - height / 2;
            
            // 페이지 번호: 교실(Room)과 동일한 페이지에 표시되도록 설정
            const pageNumber = roomElement.pageNumber != null 
                ? roomElement.pageNumber 
                : (this.core.currentPage || this.core.state.currentPage || 1);
            
            const apElement = {
                type: 'wireless_ap',
                elementType: 'wireless_ap',
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                xCoordinate: x,
                yCoordinate: y,
                width,
                height,
                radius: (shapeType === 'circle' || shapeType === 'circle-l') ? radius : null,
                shapeType,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                letterColor: letterColor,
                borderWidth: 2,
                label: ap.newLabelNumber,
                pageNumber,
                zIndex: 1000,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(apElement);
            createdCount++;
            console.log('✅ AP 생성 완료 (보기 모드):', ap.apId, ap.newLabelNumber, '교실:', roomElement.label || roomElement.id, '페이지:', pageNumber);
        });
        
        console.log('✅ 무선AP 보기 모드 - 렌더링 완료: 생성', createdCount, '개, 스킵', skippedCount, '개');
        
        // 강제 렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
    }
    
    /**
     * 네트워크 장비 렌더링
     */
    renderNetworkEquipments(equipments) {
        equipments.forEach(equipment => {
            const element = {
                type: 'network_equipment',
                referenceId: equipment.equipmentId,
                x: equipment.xCoordinate,
                y: equipment.yCoordinate,
                width: equipment.width || 50,
                height: equipment.height || 65,
                name: equipment.name,
                equipmentType: equipment.equipmentType,
                color: equipment.color || '#3b82f6',
                layerOrder: 900,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(element);
        });
    }
    
    /**
     * AP/MDF 요소 제거
     */
    clearApElements() {
        const elements = this.elementManager.getAllElements();
        const apElements = elements.filter(e => 
            e.elementType === 'wireless_ap' || 
            e.elementType === 'mdf_idf' ||
            e.type === 'wireless_ap' || 
            e.type === 'network_equipment' ||
            e.type === 'mdf_idf'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
}

