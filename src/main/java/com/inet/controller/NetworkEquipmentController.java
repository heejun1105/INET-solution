package com.inet.controller;

import com.inet.entity.NetworkEquipment;
import com.inet.entity.School;
import com.inet.service.NetworkEquipmentService;
import com.inet.service.SchoolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 네트워크 장비 컨트롤러
 * MDF/IDF 관리 API
 */
@RestController
@RequestMapping("/api/network-equipment")
public class NetworkEquipmentController {
    
    private static final Logger logger = LoggerFactory.getLogger(NetworkEquipmentController.class);
    
    @Autowired
    private NetworkEquipmentService networkEquipmentService;
    
    @Autowired
    private SchoolService schoolService;
    
    /**
     * 학교별 네트워크 장비 조회
     * GET /api/network-equipment/schools/{schoolId}
     */
    @GetMapping("/schools/{schoolId}")
    public ResponseEntity<Map<String, Object>> getEquipmentBySchool(@PathVariable Long schoolId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<NetworkEquipment> equipments = networkEquipmentService.getEquipmentBySchool(schoolId);
            response.put("success", true);
            response.put("equipments", equipments);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("네트워크 장비 조회 실패 - schoolId: {}", schoolId, e);
            response.put("success", false);
            response.put("message", "네트워크 장비 조회에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * 네트워크 장비 생성
     * POST /api/network-equipment
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createEquipment(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Long schoolId = Long.parseLong(request.get("schoolId").toString());
            School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다"));
            
            NetworkEquipment equipment = new NetworkEquipment();
            equipment.setSchool(school);
            equipment.setName((String) request.get("name"));
            equipment.setEquipmentType((String) request.get("equipmentType"));
            equipment.setColor((String) request.getOrDefault("color", "#3b82f6"));
            equipment.setXCoordinate(Double.parseDouble(request.getOrDefault("xCoordinate", 0).toString()));
            equipment.setYCoordinate(Double.parseDouble(request.getOrDefault("yCoordinate", 0).toString()));
            equipment.setWidth(Double.parseDouble(request.getOrDefault("width", 50).toString()));
            equipment.setHeight(Double.parseDouble(request.getOrDefault("height", 65).toString()));
            equipment.setDescription((String) request.get("description"));
            
            NetworkEquipment saved = networkEquipmentService.createEquipment(equipment);
            
            response.put("success", true);
            response.put("equipment", saved);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
            
        } catch (Exception e) {
            logger.error("네트워크 장비 생성 실패", e);
            response.put("success", false);
            response.put("message", "네트워크 장비 생성에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * 네트워크 장비 수정
     * PUT /api/network-equipment/{equipmentId}
     */
    @PutMapping("/{equipmentId}")
    public ResponseEntity<Map<String, Object>> updateEquipment(
            @PathVariable Long equipmentId,
            @RequestBody NetworkEquipment equipment) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            NetworkEquipment updated = networkEquipmentService.updateEquipment(equipmentId, equipment);
            response.put("success", true);
            response.put("equipment", updated);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("네트워크 장비 수정 실패 - equipmentId: {}", equipmentId, e);
            response.put("success", false);
            response.put("message", "네트워크 장비 수정에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * 네트워크 장비 삭제
     * DELETE /api/network-equipment/{equipmentId}
     */
    @DeleteMapping("/{equipmentId}")
    public ResponseEntity<Map<String, Object>> deleteEquipment(@PathVariable Long equipmentId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            networkEquipmentService.deleteEquipment(equipmentId);
            response.put("success", true);
            response.put("message", "네트워크 장비가 삭제되었습니다");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("네트워크 장비 삭제 실패 - equipmentId: {}", equipmentId, e);
            response.put("success", false);
            response.put("message", "네트워크 장비 삭제에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}

