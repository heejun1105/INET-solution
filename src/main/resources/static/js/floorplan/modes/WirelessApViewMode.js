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
        await this.loadAndRenderWirelessAps();
        
        // 강제 렌더링
        this.core.markDirty();
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
     * 무선AP 렌더링
     */
    renderWirelessAps(wirelessAps) {
        wirelessAps.forEach(ap => {
            if (!ap.classroomId) return;
            
            const roomElement = this.elementManager.findElementByReferenceId(ap.classroomId);
            if (!roomElement) return;
            
            const apElement = {
                type: 'wireless_ap',
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                x: roomElement.x + roomElement.width / 2,
                y: roomElement.y + roomElement.height - 10,
                radius: Math.min(roomElement.width, roomElement.height) / 30,
                color: '#ef4444',
                label: ap.newLabelNumber,
                layerOrder: 1000,
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
     * AP 요소 제거
     */
    clearApElements() {
        const elements = this.elementManager.getAllElements();
        const apElements = elements.filter(e => 
            e.type === 'wireless_ap' || e.type === 'network_equipment'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
}

