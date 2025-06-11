package com.inet.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import com.inet.entity.Uid;
import com.inet.entity.School;

import java.util.List;
import java.util.Optional;

@Repository
public interface UidRepository extends JpaRepository<Uid, Long> {
    
    // cate로 검색
    List<Uid> findByCate(String cate);
    
    // cate와 idNumber로 검색
    Optional<Uid> findByCateAndIdNumber(String cate, Long idNumber);
    
    // cate별 idNumber 최대값 조회
    Optional<Uid> findTopByCateOrderByIdNumberDesc(String cate);
    
    // cate 존재 여부 확인
    boolean existsByCate(String cate);
    
    // 학교별 Uid 검색
    List<Uid> findBySchool(School school);
    
    // 학교와 cate로 Uid 검색
    List<Uid> findBySchoolAndCate(School school, String cate);
    
    // 학교와 cate별 idNumber 최대값 조회
    Optional<Uid> findTopBySchoolAndCateOrderByIdNumberDesc(School school, String cate);
    
    // 학교, 카테고리, ID 번호로 Uid 검색
    Optional<Uid> findBySchoolAndCateAndIdNumber(School school, String cate, Long idNumber);

    // 학교, 카테고리, 제조년으로 최대 ID 번호 조회
    Optional<Uid> findTopBySchoolAndCateAndMfgYearOrderByIdNumberDesc(School school, String cate, String mfgYear);
    
    // 학교, 카테고리, 제조년, ID 번호로 Uid 검색
    Optional<Uid> findBySchoolAndCateAndMfgYearAndIdNumber(School school, String cate, String mfgYear, Long idNumber);

    @Modifying
    @Query("DELETE FROM Uid u WHERE u.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(Long schoolId);

    @Query("SELECT COUNT(u) FROM Uid u WHERE u.school.schoolId = :schoolId")
    long countBySchoolSchoolId(Long schoolId);

    // 학교와 카테고리로 제조년 목록 조회
    @Query("SELECT DISTINCT u.mfgYear FROM Uid u WHERE u.school.schoolId = :schoolId AND u.cate = :cate ORDER BY u.mfgYear")
    List<String> findDistinctMfgYearBySchoolSchoolIdAndCateOrderByMfgYear(Long schoolId, String cate);

    @Query("SELECT u FROM Uid u WHERE u.school.schoolId = :schoolId")
    List<Uid> findBySchoolSchoolId(Long schoolId);
    
    // 학교별 카테고리 목록 조회
    @Query("SELECT DISTINCT u.cate FROM Uid u WHERE u.school.schoolId = :schoolId ORDER BY u.cate")
    List<String> findDistinctCateBySchoolSchoolIdOrderByCate(Long schoolId);
} 