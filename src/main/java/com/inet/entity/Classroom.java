package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import lombok.EqualsAndHashCode;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonView;
import com.inet.config.Views;

@Entity
@Table(name = "classroom")
@Getter
@Setter
@ToString(exclude = {"devices"})
@EqualsAndHashCode(exclude = {"devices"})
@AllArgsConstructor
@NoArgsConstructor
public class Classroom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "classroom_id")
    @JsonView(Views.Summary.class)
    private Long classroomId;

    @Column(name = "room_name")
    @JsonView(Views.Summary.class)
    private String roomName;

    @Column(name = "x_coordinate")
    @JsonProperty("xCoordinate")
    @JsonView(Views.Summary.class)
    private Integer xCoordinate;

    @Column(name = "y_coordinate")
    @JsonProperty("yCoordinate")
    @JsonView(Views.Summary.class)
    private Integer yCoordinate;

    @Column(name = "width", columnDefinition = "INT DEFAULT 100")
    @JsonView(Views.Summary.class)
    private Integer width = 100;

    @Column(name = "height", columnDefinition = "INT DEFAULT 100")
    @JsonView(Views.Summary.class)
    private Integer height = 100;

    @ManyToOne
    @JoinColumn(name = "school_id")
    @JsonView(Views.Detail.class)
    private School school;

    @OneToMany(mappedBy = "classroom")
    @JsonManagedReference
    @JsonView(Views.Detail.class)
    private List<Device> devices;

    // Explicit getter methods
    public Long getClassroomId() {
        return this.classroomId;
    }

    public String getRoomName() {
        return this.roomName;
    }

    public School getSchool() {
        return this.school;
    }

    public List<Device> getDevices() {
        return this.devices;
    }

    // Manual setter methods for WirelessApService
    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public void setXCoordinate(Integer xCoordinate) {
        this.xCoordinate = xCoordinate;
    }

    public void setYCoordinate(Integer yCoordinate) {
        this.yCoordinate = yCoordinate;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }
} 