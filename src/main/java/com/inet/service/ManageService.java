package com.inet.service;

import com.inet.entity.Manage;
import com.inet.entity.School;
import com.inet.repository.ManageRepository;
import com.inet.repository.SchoolRepository;
import com.inet.repository.DeviceRepository;
import com.inet.entity.Device;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class ManageService {
    private final ManageRepository manageRepository;
    private final SchoolRepository schoolRepository;
    private final DeviceRepository deviceRepository;
    private static final Logger log = LoggerFactory.getLogger(ManageService.class);

    public List<String> getManageCatesBySchool(Long schoolId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        
        return manageRepository.findDistinctManageCateBySchool(school);
    }

    public List<Integer> getYearsBySchoolAndManageCate(Long schoolId, String manageCate) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        return manageRepository.findDistinctYearBySchoolAndManageCate(school, manageCate);
    }

    public Long getNextManageNum(Long schoolId, String manageCate, Integer year) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        
        List<Manage> manages;
        if (year != null) {
            // 특정 연도가 선택된 경우: 해당 카테고리 + 연도의 번호들만
            manages = manageRepository.findBySchoolAndManageCateAndYearOrderByManageNumDesc(school, manageCate, year);
        } else {
            // 연도가 선택되지 않은 경우: 해당 카테고리의 모든 연도의 번호들
            manages = manageRepository.findBySchoolAndManageCateAllYearsOrderByManageNumDesc(school, manageCate);
        }
        
        return manages.isEmpty() ? 1L : manages.get(0).getManageNum() + 1;
    }

    public List<Long> getManageNumsWithNext(Long schoolId, String manageCate, Integer year) {
        log.info("=== getManageNumsWithNext 호출 ===");
        log.info("schoolId: {}, manageCate: {}, year: {}", schoolId, manageCate, year);
        
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        
        List<Long> existingNums;
        
        if (year != null) {
            // 특정 연도가 선택된 경우
            existingNums = manageRepository.findBySchoolAndManageCateAndYearOrderByManageNumDesc(
                school, manageCate, year)
                .stream()
                .map(Manage::getManageNum)
                .collect(Collectors.toList());
            log.info("특정 연도({}) 검색 결과: {}", year, existingNums);
        } else {
            // 연도가 선택되지 않은 경우 - 해당 카테고리의 모든 연도 데이터 조회
            existingNums = manageRepository.findBySchoolAndManageCateAllYearsOrderByManageNumDesc(
                school, manageCate)
                .stream()
                .map(Manage::getManageNum)
                .collect(Collectors.toList());
            log.info("모든 연도 검색 결과: {}", existingNums);
        }
        
        // 다음 번호 계산
        Long nextNum = 1L;
        if (!existingNums.isEmpty()) {
            Long maxNum = existingNums.stream().max(Long::compareTo).orElse(0L);
            nextNum = maxNum + 1;
            log.info("최대 번호: {}, 다음 번호: {}", maxNum, nextNum);
        }
        
        // 기존 번호들을 정렬하고 다음 번호 추가
        List<Long> result = new ArrayList<>(existingNums);
        result.sort(Long::compareTo);
        if (!result.contains(nextNum)) {
            result.add(nextNum);
        }
        
        log.info("최종 결과: {}", result);
        return result;
    }

    @Transactional
    public Manage findOrCreate(School school, String cate, Integer year, Long num) {
        log.info("=== findOrCreate 호출 ===");
        log.info("학교: {}, 카테고리: {}, 연도: {}, 번호: {}", 
                school.getSchoolName(), cate, year, num);
        
        // 학교별로 정확한 검색 수행
        Optional<Manage> existingManage = manageRepository
            .findBySchoolAndManageCateAndYearAndManageNum(school, cate, year, num);
        
        if (existingManage.isPresent()) {
            log.info("기존 Manage 찾음: ID={}, 학교={}, 카테고리={}, 연도={}, 번호={}", 
                    existingManage.get().getManageId(), 
                    existingManage.get().getSchool().getSchoolName(),
                    existingManage.get().getManageCate(),
                    existingManage.get().getYear(),
                    existingManage.get().getManageNum());
            return existingManage.get();
        }
        
        // 새로운 Manage 생성
        log.info("새로운 Manage 생성: 학교={}, 카테고리={}, 연도={}, 번호={}", 
                school.getSchoolName(), cate, year, num);
        
        Manage newManage = new Manage();
        newManage.setSchool(school);
        newManage.setManageCate(cate);
        newManage.setYear(year);
        newManage.setManageNum(num);
        
        Manage savedManage = manageRepository.save(newManage);
        log.info("새로운 Manage 저장 완료: ID={}", savedManage.getManageId());
        
        return savedManage;
    }

    // 학교별 Manage 목록 조회 (Device 기반)
    public List<Manage> findBySchoolId(Long schoolId) {
        // Device에서 schoolId로 Manage 추출 (중복 제거)
        return deviceRepository.findBySchoolSchoolId(schoolId).stream()
            .map(Device::getManage)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .toList();
    }

    // 학교별 Manage 목록 조회 (Manage 테이블에서 직접)
    public List<Manage> findDirectBySchoolId(Long schoolId) {
        return manageRepository.findBySchoolSchoolId(schoolId);
    }
} 