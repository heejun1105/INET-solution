package com.inet.repository;

import com.inet.entity.Device;
import com.inet.entity.School;
import com.inet.entity.Classroom;
import com.inet.entity.Uid;
import com.inet.entity.Operator;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {
    List<Device> findBySchool(School school);

    // 페이징 + 학교 + 타입 조건 검색
    Page<Device> findBySchoolAndType(School school, String type, Pageable pageable);
    Page<Device> findBySchool(School school, Pageable pageable);
    Page<Device> findByType(String type, Pageable pageable);
    Page<Device> findAll(Pageable pageable);

    // 교실 관련 검색
    Page<Device> findBySchoolAndTypeAndClassroom(School school, String type, Classroom classroom, Pageable pageable);
    Page<Device> findBySchoolAndClassroom(School school, Classroom classroom, Pageable pageable);
    Page<Device> findByClassroom(Classroom classroom, Pageable pageable);

    // 교실 관련 검색 (페이징 없음)
    List<Device> findBySchoolAndTypeAndClassroom(School school, String type, Classroom classroom);
    List<Device> findBySchoolAndClassroom(School school, Classroom classroom);
    List<Device> findByClassroom(Classroom classroom);

    // type 목록 조회
    @Query("SELECT DISTINCT d.type FROM Device d")
    List<String> findDistinctTypes();

    List<Device> findBySchoolSchoolId(Long schoolId);
    List<Device> findByType(String type);
    List<Device> findBySchoolSchoolIdAndType(Long schoolId, String type);

    List<Device> findByClassroomRoomName(String roomName);
    List<Device> findByClassroomRoomNameAndType(String roomName, String type);
    
    // Uid 관련 검색
    Optional<Device> findByUid(Uid uid);
    List<Device> findByUidCate(String cate);

    // 삭제 관련
    @Modifying
    @Query("DELETE FROM Device d WHERE d.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(Long schoolId);

    @Query("SELECT COUNT(d) FROM Device d WHERE d.school.schoolId = :schoolId")
    long countBySchoolSchoolId(Long schoolId);
    
    // 교실 참조 해제
    @Modifying
    @Query("UPDATE Device d SET d.classroom = NULL WHERE d.school.schoolId = :schoolId")
    int updateClassroomToNullBySchoolId(Long schoolId);

    // 통계용 메서드 추가
    long countByUnusedFalseOrUnusedIsNull();
    
    // 중복 검증용 메서드
    @Query("SELECT d FROM Device d WHERE d.school = :school AND d.uid.cate = :cate AND d.uid.mfgYear = :mfgYear AND d.uid.idNumber = :idNumber")
    List<Device> findBySchoolAndUidCateAndUidMfgYearAndUidIdNumber(
        @org.springframework.data.repository.query.Param("school") School school,
        @org.springframework.data.repository.query.Param("cate") String cate,
        @org.springframework.data.repository.query.Param("mfgYear") String mfgYear,
        @org.springframework.data.repository.query.Param("idNumber") Long idNumber);
    
    @Query("SELECT d FROM Device d WHERE d.school = :school AND d.manage.manageCate = :manageCate AND d.manage.manageNum = :manageNum " +
           "AND (d.manage.year = :year OR (d.manage.year IS NULL AND :year IS NULL))")
    List<Device> findBySchoolAndManageManageCateAndManageYearAndManageManageNum(
        @org.springframework.data.repository.query.Param("school") School school,
        @org.springframework.data.repository.query.Param("manageCate") String manageCate,
        @org.springframework.data.repository.query.Param("year") Integer year,
        @org.springframework.data.repository.query.Param("manageNum") Long manageNum);
    
    // 특정 교실 이름들에 있는 장비 조회 (학교, 타입 조건 포함)
    List<Device> findByClassroomRoomNameInAndSchoolSchoolIdAndType(List<String> classroomNames, Long schoolId, String type);
    
    // 특정 교실 이름들에 있는 장비 조회 (학교 조건만)
    List<Device> findByClassroomRoomNameInAndSchoolSchoolId(List<String> classroomNames, Long schoolId);
    
    // 특정 교실 이름들에 있는 장비 조회 (교실 이름만)
    List<Device> findByClassroomRoomNameIn(List<String> classroomNames);
    
    // 담당자별 장비 조회
    List<Device> findBySchoolAndOperator(School school, Operator operator);
} 