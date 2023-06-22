<template>
    <k-slot>
        <div class="backdrop" />
        <div class="main">
            <div class="center-div">
                <h1>test</h1>
            </div>
        </div>
    </k-slot>
</template>
<style scoped lang="css">
.backdrop {
    font-family: Microsoft Yahei;
    background-color: #006dae;
    width: 100%;
    height: 100%;
    z-index: 114514;
    position: fixed;
}

.main {
    z-index: 1919810;
}

.center-div {
}
</style>