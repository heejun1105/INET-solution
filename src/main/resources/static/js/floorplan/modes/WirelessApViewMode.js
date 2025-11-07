/**
 * WirelessApViewMode.js
 * 무선AP 보기 모드 매니저
 * 
 * 책임:
 * - 저장된 무선AP 표시 (읽기 전용)
 * - 네트워크 장비 표시
 */

export default class WirelessApViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
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
            this.savedApPositions = {};
            savedAps.forEach(apData => {
                if (apData.referenceId) {
                    this.savedApPositions[apData.referenceId] = {
                        x: apData.xCoordinate,
                        y: apData.yCoordinate,
                        backgroundColor: apData.backgroundColor,
                        borderColor: apData.borderColor
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
        wirelessAps.forEach(ap => {
            if (!ap.classroomId) return;
            
            const roomElement = this.elementManager.findElementByReferenceId(ap.classroomId);
            if (!roomElement) return;
            
            // 저장된 위치 확인
            const savedPosition = this.getSavedApPosition(ap.apId);
            
            // 설계 모드와 동일한 크기: 지름 40 = 반지름 20
            const apRadius = 20;
            let x, y, backgroundColor = '#ef4444', borderColor = '#000000';
            
            if (savedPosition) {
                x = savedPosition.x - apRadius;
                y = savedPosition.y - apRadius;
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
            } else {
                const centerX = (roomElement.xCoordinate || roomElement.x) + (roomElement.width || 100) / 2;
                const centerY = (roomElement.yCoordinate || roomElement.y) + (roomElement.height || 100) / 2 + 30;
                x = centerX - apRadius;
                y = centerY - apRadius;
            }
            
            const apElement = {
                type: 'wireless_ap',
                elementType: 'wireless_ap',
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                xCoordinate: x,
                yCoordinate: y,
                width: apRadius * 2, // 지름
                height: apRadius * 2, // 지름 (원형이므로)
                radius: apRadius,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 2,
                label: ap.newLabelNumber,
                zIndex: 1000,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(apElement);
        });
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

