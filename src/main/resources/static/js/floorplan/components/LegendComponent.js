/**
 * LegendComponent.js
 * 범례 컴포넌트
 * 
 * 책임:
 * - 장비 보기 범례 표시 (cate 기준)
 * - AP 보기 범례 표시 (고정 범례)
 * - 토글 기능 (접기/펼치기)
 */

export default class LegendComponent {
    constructor(core, mode) {
        this.core = core;
        this.mode = mode; // 'equipment' or 'wireless-ap'
        this.isExpanded = true;
        this.legendContainer = null;
        
        console.log('📋 LegendComponent 초기화:', mode);
    }
    
    /**
     * 범례 생성 및 표시
     */
    create() {
        // 기존 범례 제거
        this.remove();
        
        // 범례 컨테이너 생성
        this.legendContainer = document.createElement('div');
        this.legendContainer.id = 'floorplan-legend';
        this.legendContainer.className = 'floorplan-legend';
        
        // 토글 버튼
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'legend-toggle-btn';
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> 범례';
        toggleBtn.addEventListener('click', () => this.toggle());
        
        // 범례 내용 컨테이너
        const content = document.createElement('div');
        content.className = 'legend-content';
        content.id = 'legend-content';
        
        this.legendContainer.appendChild(toggleBtn);
        this.legendContainer.appendChild(content);
        
        // 캔버스 컨테이너에 추가 (workspace-canvas-container)
        const canvasContainer = this.core.container;
        if (canvasContainer) {
            // container가 workspace-canvas-container인지 확인
            if (canvasContainer.classList && canvasContainer.classList.contains('workspace-canvas-container')) {
                canvasContainer.appendChild(this.legendContainer);
            } else if (canvasContainer.parentElement) {
                // parentElement가 workspace-canvas-container일 수 있음
                const parent = canvasContainer.parentElement;
                if (parent.classList && parent.classList.contains('workspace-canvas-container')) {
                    parent.appendChild(this.legendContainer);
                } else {
                    // 최상위 컨테이너 찾기
                    let current = canvasContainer;
                    while (current && current.parentElement) {
                        current = current.parentElement;
                        if (current.classList && current.classList.contains('workspace-canvas-container')) {
                            current.appendChild(this.legendContainer);
                            return;
                        }
                    }
                    // 찾지 못하면 container의 parentElement에 추가
                    canvasContainer.parentElement.appendChild(this.legendContainer);
                }
            }
        }
        
        // 초기 범례 내용 로드
        this.updateContent();
    }
    
    /**
     * 범례 내용 업데이트
     */
    async updateContent() {
        const content = document.getElementById('legend-content');
        if (!content) return;
        
        if (this.mode === 'equipment') {
            await this.renderEquipmentLegend(content);
        } else if (this.mode === 'wireless-ap') {
            this.renderApLegend(content);
        }
    }
    
    /**
     * 장비 보기 범례 렌더링
     */
    async renderEquipmentLegend(container) {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/devices-by-classroom`);
            const result = await response.json();
            
            if (!result.success || !result.devicesByClassroom) {
                container.innerHTML = '<p class="legend-empty">범례 데이터가 없습니다</p>';
                return;
            }
            
            // 모든 장비의 cate 수집
            const cateSet = new Set();
            Object.values(result.devicesByClassroom).forEach(devices => {
                devices.forEach(device => {
                    if (device.uidCate) {
                        cateSet.add(device.uidCate);
                    }
                });
            });
            
            if (cateSet.size === 0) {
                container.innerHTML = '<p class="legend-empty">범례 데이터가 없습니다</p>';
                return;
            }
            
            // cate를 장비 종류로 그룹화
            const cateToTypeMap = this.getCateToTypeMap();
            const typeGroups = {};
            
            cateSet.forEach(cate => {
                const type = cateToTypeMap[cate] || '기타';
                if (!typeGroups[type]) {
                    typeGroups[type] = [];
                }
                typeGroups[type].push(cate);
            });
            
            // 범례 HTML 생성
            let html = '<div class="legend-title">범례</div>';
            html += '<div class="legend-items">';
            
            Object.keys(typeGroups).sort().forEach(type => {
                const cates = typeGroups[type].sort();
                const cateStr = cates.length > 1 ? cates.join(', ') : cates[0];
                html += `
                    <div class="legend-item">
                        <span class="legend-label">${cateStr} - ${type}</span>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            console.error('장비 범례 렌더링 오류:', error);
            container.innerHTML = '<p class="legend-error">범례 로드 중 오류가 발생했습니다</p>';
        }
    }
    
    /**
     * AP 보기 범례 렌더링 (고정 범례)
     */
    renderApLegend(container) {
        const legendItems = [
            { shape: 'rectangle', color: '#ef4444', label: 'MDF' },
            { shape: 'rectangle', color: '#000000', label: 'IDF#' },
            { shape: 'circle', color: '#000000', label: '도교육청AP#' },
            { shape: 'triangle', color: '#000000', label: '4차,3차' },
            { shape: 'diamond', color: '#000000', label: '학교구입' }
        ];
        
        let html = '<div class="legend-title">범례</div>';
        html += '<div class="legend-items">';
        
        legendItems.forEach(item => {
            let styleAttr = '';
            if (item.shape === 'triangle') {
                styleAttr = `style="border-bottom-color: ${item.color}"`;
            } else {
                styleAttr = `style="background-color: ${item.color}"`;
            }
            html += `
                <div class="legend-item">
                    <span class="legend-shape legend-shape-${item.shape}" ${styleAttr}></span>
                    <span class="legend-label">- ${item.label}</span>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * cate를 장비 종류로 매핑
     */
    getCateToTypeMap() {
        return {
            // 데스크톱 관련
            'DW': '데스크톱',
            'DE': '데스크톱',
            'DK': '데스크톱',
            'DC': '데스크톱',
            'DS': '데스크톱',
            'DD': '데스크톱',
            'DT': '데스크톱',
            // 기타 장비
            'MO': '모니터',
            'PR': '프린터',
            'TV': 'TV',
            'ID': '전자칠판',
            'ED': '전자교탁',
            'DI': 'DID',
            'TB': '태블릿',
            'PJ': '프로젝터',
            'ET': '기타'
        };
    }
    
    /**
     * 토글 (접기/펼치기)
     */
    toggle() {
        this.isExpanded = !this.isExpanded;
        const content = document.getElementById('legend-content');
        const toggleBtn = this.legendContainer?.querySelector('.legend-toggle-btn');
        
        if (content) {
            content.style.display = this.isExpanded ? 'block' : 'none';
        }
        
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = this.isExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
            }
        }
    }
    
    /**
     * 범례 제거
     */
    remove() {
        if (this.legendContainer && this.legendContainer.parentElement) {
            this.legendContainer.parentElement.removeChild(this.legendContainer);
        }
        this.legendContainer = null;
    }
    
    /**
     * 범례 데이터 가져오기 (PPT용)
     */
    async getLegendData() {
        if (this.mode === 'equipment') {
            return await this.getEquipmentLegendData();
        } else if (this.mode === 'wireless-ap') {
            return this.getApLegendData();
        }
        return null;
    }
    
    /**
     * 장비 범례 데이터 가져오기 (PPT용)
     */
    async getEquipmentLegendData() {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/devices-by-classroom`);
            const result = await response.json();
            
            if (!result.success || !result.devicesByClassroom) {
                return [];
            }
            
            const cateSet = new Set();
            Object.values(result.devicesByClassroom).forEach(devices => {
                devices.forEach(device => {
                    if (device.uidCate) {
                        cateSet.add(device.uidCate);
                    }
                });
            });
            
            const cateToTypeMap = this.getCateToTypeMap();
            const typeGroups = {};
            
            cateSet.forEach(cate => {
                const type = cateToTypeMap[cate] || '기타';
                if (!typeGroups[type]) {
                    typeGroups[type] = [];
                }
                typeGroups[type].push(cate);
            });
            
            return Object.keys(typeGroups).sort().map(type => {
                const cates = typeGroups[type].sort();
                const cateStr = cates.length > 1 ? cates.join(', ') : cates[0];
                return {
                    label: `${cateStr} - ${type}`,
                    type: 'text'
                };
            });
            
        } catch (error) {
            console.error('장비 범례 데이터 가져오기 오류:', error);
            return [];
        }
    }
    
    /**
     * AP 범례 데이터 가져오기 (PPT용)
     */
    getApLegendData() {
        return [
            { shape: 'rectangle', color: '#ef4444', label: 'MDF', type: 'shape' },
            { shape: 'rectangle', color: '#000000', label: 'IDF#', type: 'shape' },
            { shape: 'circle', color: '#000000', label: '도교육청AP#', type: 'shape' },
            { shape: 'triangle', color: '#000000', label: '4차,3차', type: 'shape' },
            { shape: 'diamond', color: '#000000', label: '학교구입', type: 'shape' }
        ];
    }
}

