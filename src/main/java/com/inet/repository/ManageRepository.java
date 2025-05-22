package com.inet.repository;

import com.inet.entity.Manage;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ManageRepository extends JpaRepository<Manage, Long> {
    @Query("SELECT DISTINCT m.manageCate FROM Manage m")
    List<String> findDistinctManageCate();

    @Query("SELECT DISTINCT m.year FROM Manage m")
    List<Integer> findDistinctYear();

    @Query("SELECT MAX(m.manageNum) FROM Manage m WHERE m.manageCate = :cate AND m.year = :year")
    Long findMaxManageNumByCateAndYear(@Param("cate") String cate, @Param("year") Integer year);

    Optional<Manage> findByManageCateAndYearAndManageNum(String manageCate, Integer year, Long manageNum);

    @Query("SELECT DISTINCT m.manageCate FROM Manage m WHERE m.school = :school")
    List<String> findDistinctManageCateBySchool(@Param("school") School school);

    @Query("SELECT DISTINCT m.year FROM Manage m WHERE m.school = :school")
    List<Integer> findDistinctYearBySchool(@Param("school") School school);

    @Query("SELECT DISTINCT m.manageCate FROM Manage m WHERE m.school = :school AND m.manageCate = :manageCate AND m.year IS NOT NULL")
    List<Integer> findDistinctYearBySchoolAndManageCate(@Param("school") School school, @Param("manageCate") String manageCate);

    @Query("SELECT m FROM Manage m WHERE m.school = :school AND m.manageCate = :manageCate AND m.year = :year ORDER BY m.manageNum DESC")
    List<Manage> findBySchoolAndManageCateAndYearOrderByManageNumDesc(
        @Param("school") School school, 
        @Param("manageCate") String manageCate, 
        @Param("year") Integer year
    );

    @Query("SELECT m FROM Manage m WHERE m.school = :school AND m.manageCate = :manageCate AND m.year IS NULL ORDER BY m.manageNum DESC")
    List<Manage> findBySchoolAndManageCateAndYearIsNullOrderByManageNumDesc(
        @Param("school") School school, 
        @Param("manageCate") String manageCate
    );

    @Modifying
    @Query("DELETE FROM Manage m WHERE m.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(Long schoolId);

    @Query("SELECT COUNT(m) FROM Manage m WHERE m.school.schoolId = :schoolId")
    long countBySchoolSchoolId(Long schoolId);

    @Query("SELECT m FROM Manage m WHERE m.school.schoolId = :schoolId")
    List<Manage> findBySchoolSchoolId(Long schoolId);
} 