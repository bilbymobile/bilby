allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Build output lives beside the Dart build output rather than under android/,
// so `flutter clean` actually cleans everything.
val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    project.layout.buildDirectory.value(newBuildDir.dir(project.name))
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
