package com.inet.repository;

import com.inet.entity.NetworkEquipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 네트워크 장비 레포지토리
 */
@Repository
public interface NetworkEquipmentRepository extends JpaRepository<NetworkEquipment, Long> {
    
    /**
     * 학교별 네트워크 장비 조회
     */
    List<NetworkEquipment> findBySchool_SchoolId(Long schoolId);
    
    /**
     * 학교 및 장비 타입별 조회
     */
    List<NetworkEquipment> findBySchool_SchoolIdAndEquipmentType(Long schoolId, String equipmentType);
    
    /**
     * 학교별 장비 삭제
     */
    void deleteBySchool_SchoolId(Long schoolId);
}

