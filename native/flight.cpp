#include <stdint.h>

namespace {

constexpr float kRho0 = 1.225f;
constexpr float kG = 9.81f;
constexpr float kScaleHeight = 9000.0f;
constexpr float kPi = 3.14159265f;
constexpr float kOswald = 0.8f;
constexpr float kPropEfficiency = 0.8f;
constexpr float kPace = 2.2f;
constexpr int kSlots = 256;
constexpr int kFloats = 16;

float sqrtf_(float x) { return __builtin_sqrtf(x > 0.0f ? x : 0.0f); }

float expf_(float x) {
    if (x < -20.0f) return 0.0f;
    float y = x / 8.0f, term = 1.0f, sum = 1.0f;
    for (int i = 1; i <= 7; ++i) {
        term *= y / static_cast<float>(i);
        sum += term;
    }
    sum *= sum;
    sum *= sum;
    sum *= sum;
    return sum;
}

float maxf(float a, float b) { return a > b ? a : b; }

enum Field {
    kMass, kWingArea, kSpan, kEngine, kIsProp, kTop, kMin, kBoostMul,
    kInduced, kCd0, kClMax, kBoostEngine, kPropRef, kLastThrust, kLastDrag, kLastDensity
};

class Airframe {
public:
    explicit Airframe(float* f) : f_(f) {}

    void calibrate() {
        const float weight = f_[kMass] * kG;
        const float aspect = f_[kSpan] * f_[kSpan] / f_[kWingArea];
        f_[kInduced] = 1.0f / (kPi * kOswald * aspect);
        f_[kClMax] = 2.0f * weight / (kRho0 * f_[kWingArea] * f_[kMin] * f_[kMin]);
        f_[kPropRef] = 0.35f * f_[kTop];
        const float top = f_[kTop];
        const float qs = 0.5f * kRho0 * top * top * f_[kWingArea];
        const float induced = f_[kInduced] * weight * weight / qs;
        float cd0 = (thrustAt(top, f_[kEngine], 1.0f) - induced) / qs;
        f_[kCd0] = maxf(cd0, 0.004f);
        const float vb = top * f_[kBoostMul];
        const float dragAtBoost = drag(vb, kRho0, 1.0f);
        f_[kBoostEngine] = f_[kIsProp] > 0.5f ? dragAtBoost * vb / kPropEfficiency : dragAtBoost;
    }

    float step(float speed, float throttle, bool boosting, bool burning, float altitude, float sinClimb, float load, float dt) {
        const float rho = density(altitude);
        float engine = boosting ? f_[kBoostEngine] : f_[kEngine] * maxf(0.05f, throttle);
        if (burning) engine *= 0.65f;
        const float lapse = expf_((f_[kIsProp] > 0.5f ? -0.6f : -0.75f) * maxf(altitude, 0.0f) / kScaleHeight);
        const float thrust = thrustAt(speed, engine, lapse);
        const float d = drag(speed, rho, maxf(load, 0.0f));
        f_[kLastThrust] = thrust;
        f_[kLastDrag] = d;
        f_[kLastDensity] = rho;
        const float accel = (thrust - d) / f_[kMass] - kG * sinClimb;
        return speed + accel * dt * kPace;
    }

    float stallSpeed(float altitude, float load) const {
        const float lift = sqrtf_(maxf(load, 0.6f)) * f_[kMass] * kG;
        return sqrtf_(2.0f * lift / (density(altitude) * f_[kWingArea] * f_[kClMax]));
    }

private:
    static float density(float altitude) { return kRho0 * expf_(-maxf(altitude, 0.0f) / kScaleHeight); }

    float thrustAt(float speed, float engine, float lapse) const {
        if (f_[kIsProp] > 0.5f) return kPropEfficiency * engine * lapse / maxf(speed, f_[kPropRef]);
        return engine * lapse;
    }

    float drag(float speed, float rho, float load) const {
        const float qs = maxf(0.5f * rho * speed * speed * f_[kWingArea], 1.0f);
        const float lift = load * f_[kMass] * kG;
        return qs * f_[kCd0] + f_[kInduced] * lift * lift / qs;
    }

    float* f_;
};

float slots[kSlots * kFloats];

Airframe at(int i) { return Airframe(slots + (static_cast<unsigned>(i) % kSlots) * kFloats); }

}

extern "C" {

float* fm_params(int i) { return slots + (static_cast<unsigned>(i) % kSlots) * kFloats; }

int fm_slots() { return kSlots; }

void fm_calibrate(int i) { at(i).calibrate(); }

float fm_step(int i, float speed, float throttle, int boosting, int burning, float altitude, float sinClimb, float load, float dt) {
    return at(i).step(speed, throttle, boosting != 0, burning != 0, altitude, sinClimb, load, dt);
}

float fm_stall_speed(int i, float altitude, float load) { return at(i).stallSpeed(altitude, load); }

}
