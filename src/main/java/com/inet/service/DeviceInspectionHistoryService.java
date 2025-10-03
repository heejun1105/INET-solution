package com.inet.service;

import com.inet.entity.DeviceInspectionHistory;
import com.inet.repository.DeviceInspectionHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class DeviceInspectionHistoryService {
    
    private final DeviceInspectionHistoryRepository deviceInspectionHistoryRepository;
    
    public DeviceInspectionHistoryService(DeviceInspectionHistoryRepository deviceInspectionHistoryRepository) {
        this.deviceInspectionHistoryRepository = deviceInspectionHistoryRepository;
    }
    
    /**
     * 검사 이력 저장
     */
    public DeviceInspectionHistory saveInspectionHistory(Long schoolId, Long inspectorId, 
                                                        Integer confirmedCount, Integer modifiedCount, 
                                                        Integer unconfirmedCount, String inspectionDetails) {
        DeviceInspectionHistory history = new DeviceInspectionHistory();
        history.setSchoolId(schoolId);
        history.setInspectorId(inspectorId);
        history.setInspectionDate(LocalDateTime.now());
        history.setConfirmedCount(confirmedCount);
        history.setModifiedCount(modifiedCount);
        history.setUnconfirmedCount(unconfirmedCount);
        history.setTotalCount(confirmedCount + modifiedCount + unconfirmedCount);
        history.setInspectionDetails(inspectionDetails);
        
        return deviceInspectionHistoryRepository.save(history);
    }
    
    /**
     * 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public Optional<DeviceInspectionHistory> findById(Long id) {
        return deviceInspectionHistoryRepository.findById(id);
    }
    
    /**
     * 학교별 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public List<DeviceInspectionHistory> findBySchoolId(Long schoolId) {
        return deviceInspectionHistoryRepository.findBySchoolIdOrderByInspectionDateDesc(schoolId);
    }
    
    /**
     * 검사자별 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public List<DeviceInspectionHistory> findByInspectorId(Long inspectorId) {
        return deviceInspectionHistoryRepository.findByInspectorIdOrderByInspectionDateDesc(inspectorId);
    }
    
    /**
     * 학교와 검사자별 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public List<DeviceInspectionHistory> findBySchoolIdAndInspectorId(Long schoolId, Long inspectorId) {
        return deviceInspectionHistoryRepository.findBySchoolIdAndInspectorIdOrderByInspectionDateDesc(schoolId, inspectorId);
    }
    
    /**
     * 최근 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public List<DeviceInspectionHistory> findRecentInspections(int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        return deviceInspectionHistoryRepository.findRecentInspections(pageable);
    }
    
    /**
     * 학교별 최근 검사 이력 조회
     */
    @Transactional(readOnly = true)
    public List<DeviceInspectionHistory> findRecentInspectionsBySchool(Long schoolId, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        return deviceInspectionHistoryRepository.findRecentInspectionsBySchool(schoolId, pageable);
    }
    
    /**
     * 검사 이력 삭제
     */
    public void deleteById(Long id) {
        deviceInspectionHistoryRepository.deleteById(id);
    }
}
