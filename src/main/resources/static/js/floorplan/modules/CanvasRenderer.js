/**
 * 캔버스 렌더러
 * 효율적인 렌더링 및 가상화 지원
 */
export default class CanvasRenderer {
    constructor(infiniteCanvasManager) {
        this.infiniteCanvasManager = infiniteCanvasManager;
        
        // 렌더링 설정
        this.enableVirtualization = true; // 가상화 활성화
        this.renderThrottle = 16; // 약 60 FPS
        this.lastRenderTime = 0;
        
        // 렌더링 큐
        this.renderQueue = new Set();
        this.isRendering = false;
    }
    
    /**
     * 요소 렌더링
     */
    renderElement(element) {
        if (!element) return;
        
        // 가상화: 뷰포트 밖의 요소는 숨김
        if (this.enableVirtualization) {
            const isVisible = this.isElementInViewport(element);
            element.style.display = isVisible ? '' : 'none';
        }
    }
    
    /**
     * 모든 요소 렌더링
     */
    renderAllElements() {
        const canvas = this.infiniteCanvasManager.canvas;
        if (!canvas) return;
        
        const elements = canvas.querySelectorAll('.room, .building, .shape, .other-space');
        
        elements.forEach(element => {
            this.renderElement(element);
        });
    }
    
    /**
     * 요소가 뷰포트 안에 있는지 확인
     */
    isElementInViewport(element) {
        try {
            const rect = element.getBoundingClientRect();
            const viewport = this.infiniteCanvasManager.viewport;
            
            // 여유 공간 추가 (미리 로드)
            const margin = 200;
            
            return !(
                rect.right < -margin ||
                rect.left > viewport.width + margin ||
                rect.bottom < -margin ||
                rect.top > viewport.height + margin
            );
        } catch (error) {
            return true; // 오류 시 기본적으로 표시
        }
    }
    
    /**
     * 렌더링 요청
     */
    requestRender(element) {
        if (element) {
            this.renderQueue.add(element);
        }
        
        if (this.isRendering) return;
        
        // 스로틀링
        const now = performance.now();
        const timeSinceLastRender = now - this.lastRenderTime;
        
        if (timeSinceLastRender < this.renderThrottle) {
            setTimeout(() => this.executeRender(), this.renderThrottle - timeSinceLastRender);
        } else {
            this.executeRender();
        }
    }
    
    /**
     * 렌더링 실행
     */
    executeRender() {
        this.isRendering = true;
        this.lastRenderTime = performance.now();
        
        requestAnimationFrame(() => {
            // 큐의 요소들 렌더링
            if (this.renderQueue.size > 0) {
                this.renderQueue.forEach(element => {
                    this.renderElement(element);
                });
                this.renderQueue.clear();
            } else {
                // 전체 렌더링
                this.renderAllElements();
            }
            
            this.isRendering = false;
        });
    }
    
    /**
     * 배치 렌더링 (여러 요소를 한 번에)
     */
    batchRender(elements) {
        if (!elements || elements.length === 0) return;
        
        elements.forEach(element => {
            this.renderQueue.add(element);
        });
        
        this.requestRender();
    }
    
    /**
     * 가상화 활성화/비활성화
     */
    setVirtualization(enabled) {
        this.enableVirtualization = enabled;
        
        if (!enabled) {
            // 가상화 비활성화 시 모든 요소 표시
            const canvas = this.infiniteCanvasManager.canvas;
            if (canvas) {
                const elements = canvas.querySelectorAll('.room, .building, .shape, .other-space');
                elements.forEach(element => {
                    element.style.display = '';
                });
            }
        } else {
            this.renderAllElements();
        }
    }
    
    /**
     * 뷰포트 변경 시 렌더링
     */
    onViewportChange() {
        if (this.enableVirtualization) {
            this.requestRender();
        }
    }
    
    /**
     * 성능 모니터링
     */
    getPerformanceStats() {
        const canvas = this.infiniteCanvasManager.canvas;
        if (!canvas) return null;
        
        const allElements = canvas.querySelectorAll('.room, .building, .shape, .other-space');
        const visibleElements = Array.from(allElements).filter(el => 
            el.style.display !== 'none'
        );
        
        return {
            totalElements: allElements.length,
            visibleElements: visibleElements.length,
            virtualizationRatio: visibleElements.length / allElements.length,
            lastRenderTime: this.lastRenderTime
        };
    }
    
    /**
     * 디버그 정보 표시
     */
    showDebugInfo() {
        const stats = this.getPerformanceStats();
        if (!stats) return;
        
        console.log('📊 Renderer Stats:', {
            'Total Elements': stats.totalElements,
            'Visible Elements': stats.visibleElements,
            'Virtualization Ratio': `${(stats.virtualizationRatio * 100).toFixed(1)}%`,
            'Last Render': `${stats.lastRenderTime.toFixed(2)}ms`
        });
    }
}

