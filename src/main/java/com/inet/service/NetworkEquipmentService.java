package com.inet.service;

import com.inet.entity.NetworkEquipment;
import com.inet.entity.School;
import com.inet.repository.NetworkEquipmentRepository;
import com.inet.repository.SchoolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * 네트워크 장비 서비스
 */
@Service
public class NetworkEquipmentService {
    
    private static final Logger logger = LoggerFactory.getLogger(NetworkEquipmentService.class);
    
    @Autowired
    private NetworkEquipmentRepository networkEquipmentRepository;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    /**
     * 학교별 네트워크 장비 조회
     */
    @Transactional(readOnly = true)
    public List<NetworkEquipment> getEquipmentBySchool(Long schoolId) {
        return networkEquipmentRepository.findBySchool_SchoolId(schoolId);
    }
    
    /**
     * 네트워크 장비 생성
     */
    @Transactional
    public NetworkEquipment createEquipment(NetworkEquipment equipment) {
        logger.info("네트워크 장비 생성: {}", equipment.getName());
        return networkEquipmentRepository.save(equipment);
    }
    
    /**
     * 네트워크 장비 수정
     */
    @Transactional
    public NetworkEquipment updateEquipment(Long equipmentId, NetworkEquipment updatedEquipment) {
        NetworkEquipment equipment = networkEquipmentRepository.findById(equipmentId)
            .orElseThrow(() -> new RuntimeException("네트워크 장비를 찾을 수 없습니다: " + equipmentId));
        
        equipment.setName(updatedEquipment.getName());
        equipment.setEquipmentType(updatedEquipment.getEquipmentType());
        equipment.setColor(updatedEquipment.getColor());
        equipment.setXCoordinate(updatedEquipment.getXCoordinate());
        equipment.setYCoordinate(updatedEquipment.getYCoordinate());
        equipment.setWidth(updatedEquipment.getWidth());
        equipment.setHeight(updatedEquipment.getHeight());
        equipment.setDescription(updatedEquipment.getDescription());
        
        logger.info("네트워크 장비 수정: {}", equipmentId);
        return networkEquipmentRepository.save(equipment);
    }
    
    /**
     * 네트워크 장비 삭제
     */
    @Transactional
    public void deleteEquipment(Long equipmentId) {
        logger.info("네트워크 장비 삭제: {}", equipmentId);
        networkEquipmentRepository.deleteById(equipmentId);
    }
    
    /**
     * 학교별 모든 네트워크 장비 삭제
     */
    @Transactional
    public void deleteAllBySchool(Long schoolId) {
        logger.info("학교의 모든 네트워크 장비 삭제: {}", schoolId);
        networkEquipmentRepository.deleteBySchool_SchoolId(schoolId);
    }
    
    /**
     * ID로 조회
     */
    @Transactional(readOnly = true)
    public Optional<NetworkEquipment> getEquipmentById(Long equipmentId) {
        return networkEquipmentRepository.findById(equipmentId);
    }
}

